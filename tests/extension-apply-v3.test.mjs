import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../extension/src/apply-background.js', import.meta.url), 'utf8');
const contentSource = fs.readFileSync(new URL('../extension/src/apply-content.js', import.meta.url), 'utf8');
const adapterSource = fs.readFileSync(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../extension/src/assistant-core.js', import.meta.url), 'utf8');
const bridgeSource = fs.readFileSync(new URL('../extension/src/content.js', import.meta.url), 'utf8');
const backgroundSource = fs.readFileSync(new URL('../extension/src/background.js', import.meta.url), 'utf8');
const ravenUrl = 'https://shipitmyguy-ux.github.io/raven/';
const firstUrl = 'https://apply.workable.com/studio-a/j/JOB-A/apply/';
const otherUrl = 'https://apply.workable.com/studio-b/j/JOB-B/apply/';
const requestId = 'request-1', attemptId = 'attempt-1', jobId = 'JT-1';
const raven = { frameId: 0, documentId: 'raven-doc', url: ravenUrl, tab: { id: 2, url: ravenUrl } };
const employer = (id, url = firstUrl, documentId = 'employer-doc') =>
  ({ frameId: 0, documentId, url, tab: { id, url } });
const envelope = (action, payload = {}, extra = {}) =>
  ({ type: 'raven-apply-attempt', version: 3, requestId, attemptId, jobId,
    action, payload, ...extra });
const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n');
const pdfSha256 = createHash('sha256').update(pdfBytes).digest('hex');
const pdfData = 'data:application/pdf;base64,' + pdfBytes.toString('base64');

function harness(persisted) {
  const state = persisted?.state || {}, tabs = persisted?.tabs || new Map();
  let listeners = [], updated, removed, nextTab = 40, sent = [];
  let pageResponse = () => ({ accepted: true });
  const chrome = {
    runtime: { lastError: null, onMessage: { addListener: fn => listeners.push(fn) } },
    storage: { local: {
      get: async key => ({ [key]: state[key] }),
      set: async value => Object.assign(state, value)
    } },
    tabs: {
      create: (options, callback) => {
        const value = { id: nextTab++, url: options.url };
        tabs.set(value.id, value); callback(value);
      },
      update: (id, options, callback) => {
        tabs.get(id).url = options.url;
        updated?.(id, { url: options.url, status: 'loading' });
        callback(tabs.get(id));
      },
      get: (id, callback) => callback(tabs.get(id)),
      sendMessage: (id, message, options, callback) => {
        sent.push({ id, message });
        callback(pageResponse(id, message));
      },
      onUpdated: { addListener: fn => updated = fn },
      onRemoved: { addListener: fn => removed = fn }
    }
  };
  const boot = () => {
    listeners = [];
    vm.runInNewContext(source, { chrome, URL, Date, JSON, Object, String, Array,
      RegExp, atob, TextEncoder, crypto: webcrypto, console, setTimeout, clearTimeout });
  };
  boot();
  const request = (message, sender = raven) => new Promise(resolve => {
    const accepted = listeners.map(fn => fn(message, sender, resolve)).some(Boolean);
    if (!accepted) resolve(undefined);
  });
  const emit = (message, sender) => {
    for (const fn of listeners) fn(message, sender, () => {});
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const open = () => request(envelope('open', { listingUrl: firstUrl, targetUrl: firstUrl,
    title: 'Artist', company: 'Studio A' }));
  const inspectReady = async (id = 40) => {
    const context = await request({ type: 'raven-apply-v3-context', url: firstUrl }, employer(id));
    emit({ type: 'raven-apply-v3-inspection', requestId, attemptId, jobId,
      revision: context.revision, status: 'ready' }, employer(id));
    await tick(); await tick();
    return context;
  };
  return { state, tabs, sent, request, emit, tick, open, inspectReady,
    navigate: (id, url, info = { url, status: 'loading' }) => { tabs.get(id).url = url; updated(id, info); },
    remove: id => { tabs.delete(id); removed(id); },
    restart: boot, setPageResponse: fn => { pageResponse = fn; } };
}

test('click-time reservation routes the same extension-owned tab after destination resolution', async () => {
  const env = harness();
  const reserved = await env.request(envelope('open', {
    listingUrl: firstUrl, title: 'Artist', company: 'Studio A'
  }));
  assert.equal(reserved.status, 'reserved');
  assert.equal(env.tabs.get(40).url, 'about:blank');
  const routed = await env.request(envelope('open', { listingUrl: firstUrl, targetUrl: firstUrl,
    title: 'Artist', company: 'Studio A' }, { requestId: 'route-request' }));
  assert.equal(routed.requestId, 'route-request');
  assert.equal(routed.tabId, 40);
  assert.equal(routed.status, 'opening');
  assert.equal(env.tabs.size, 1);
});

test('initial about:blank and target loading events do not revoke the first binding', async () => {
  const env = harness();
  const opened = await env.open();
  assert.equal(opened.status, 'opening');
  env.navigate(40, 'about:blank');
  env.navigate(40, firstUrl);
  await env.tick(); await env.tick();
  const status = await env.request(envelope('status'));
  assert.equal(status.bindingRevision, 1);
  assert.equal(status.status, 'opening');
  assert.equal(status.tabId, 40);
});

test('same-host wrong job and unrelated tabs cannot inspect or receive personal operations', async () => {
  const env = harness();
  const opened = await env.open();
  assert.equal(opened.bindingRevision, 1);
  const wrong = await env.request({ type: 'raven-apply-v3-context', url: otherUrl }, employer(41, otherUrl));
  assert.equal(wrong, null);
  env.emit({ type: 'raven-apply-v3-inspection', requestId, attemptId, jobId,
    revision: 1, status: 'ready' }, employer(41, otherUrl));
  await env.tick();
  assert.equal((await env.request(envelope('status'))).status, 'opening');
  await env.inspectReady();
  const result = await env.request(envelope('deliver', { operationId: 'profile-1',
    profile: { email: 'synthetic@example.invalid' }, answers: {} }, { bindingRevision: 1 }));
  assert.equal(result.ok, true);
  assert.equal(env.sent.at(-1).id, 40);
  assert.equal(env.sent.at(-1).message.type, 'raven-apply-v3-deliver');
  assert.equal(env.sent.at(-1).message.payload.profile.email, 'synthetic@example.invalid');
});

test('a different hash route on the same host is not the bound job', async () => {
  const env = harness();
  await env.open();
  const hashRoute = firstUrl + '#another-job';
  const context = await env.request({ type: 'raven-apply-v3-context', url: hashRoute },
    employer(40, hashRoute));
  assert.equal(context, null);
  env.emit({ type: 'raven-apply-v3-inspection', requestId, attemptId, jobId,
    revision: 1, status: 'ready' }, employer(40, hashRoute));
  await env.tick(); await env.tick();
  assert.equal((await env.request(envelope('status'))).status, 'opening');
});

test('same-posting Dover tracking redirects can rebind for automatic inspection, but other route changes cannot', async () => {
  const url = 'https://app.dover.com/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47c/';
  const env = harness();
  const opened = await env.request(envelope('open', { listingUrl: url, targetUrl: url,
    title: 'Senior 3D Artist', company: 'Warpfrog' }));
  assert.equal(opened.status, 'opening');
  const redirected = url + '?rs=76643084&utm_source=raven';
  env.navigate(40, redirected);
  await env.tick(); await env.tick();
  const moved = await env.request(envelope('status'));
  assert.equal(moved.status, 'navigated');
  const rebound = await env.request(envelope('inspect', { allowEquivalentRoute: true },
    { bindingRevision: moved.bindingRevision }));
  assert.equal(rebound.status, 'waiting_fields');
  assert.equal(rebound.observedUrl, redirected);
  assert.equal(env.sent.at(-1).message.type, 'raven-apply-v3-rebind');

  const wrongUrl = 'https://app.dover.com/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47d/?rs=76643084&utm_source=raven';
  env.navigate(40, wrongUrl);
  await env.tick(); await env.tick();
  const wrongStatus = await env.request(envelope('status'));
  const wrong = await env.request(envelope('inspect', { allowEquivalentRoute: true },
    { bindingRevision: wrongStatus.bindingRevision }));
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /navigated/);
});

test('operation ID replay never redispatches; changed payload is rejected', async () => {
  const env = harness();
  await env.open(); await env.inspectReady();
  const document = { kind: 'resume', documentSha256: 'a'.repeat(64), pdfSha256,
    filename: 'resume.pdf', dataUrl: pdfData };
  const message = envelope('deliver', { operationId: 'resume-1', document }, { bindingRevision: 1 });
  assert.equal((await env.request(message)).ok, true);
  assert.equal((await env.request(message)).ok, true);
  assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 1);
  const changed = await env.request(envelope('deliver', { operationId: 'resume-1',
    document: { ...document, documentSha256: 'b'.repeat(64) } },
    { bindingRevision: 1 }));
  assert.equal(changed.ok, false);
  assert.match(changed.error, /different content/);
  assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 1);
});

test('an uncertain selected PDF cannot be resent under a new operation ID', async () => {
  const env = harness();
  await env.open(); await env.inspectReady();
  const document = { kind: 'resume', documentSha256: 'a'.repeat(64), pdfSha256,
    filename: 'resume.pdf', dataUrl: pdfData };
  await env.request(envelope('deliver', { operationId: 'resume-1', document }, { bindingRevision: 1 }));
  env.emit({ type: 'raven-apply-v3-result', requestId, attemptId, jobId, revision: 1,
    operationId: 'resume-1', kind: 'resume', state: 'selected', result: {} }, employer(40));
  await env.tick(); await env.tick();
  const retry = await env.request(envelope('deliver', { operationId: 'resume-2', document }, { bindingRevision: 1 }));
  assert.equal(retry.ok, false);
  assert.match(retry.error, /already be selected/);
  assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 1);
});

test('navigation increments revision and reinspection uses the same extension-owned tab', async () => {
  const env = harness();
  await env.open(); await env.inspectReady();
  env.navigate(40, otherUrl);
  await env.tick(); await env.tick();
  const moved = await env.request(envelope('status'));
  assert.equal(moved.status, 'navigated');
  assert.equal(moved.bindingRevision, 2);
  const stale = await env.request(envelope('deliver',
    { operationId: 'profile-1', profile: {} }, { bindingRevision: 1 }));
  assert.equal(stale.ok, false);
  const rebound = await env.request(envelope('inspect', { useCurrentPage: true },
    { bindingRevision: 2 }));
  assert.equal(rebound.tabId, 40);
  assert.equal(rebound.status, 'waiting_fields');
  assert.equal(env.sent.at(-1).message.type, 'raven-apply-v3-rebind');
  assert.equal((await env.request({ type: 'raven-apply-v3-context', url: otherUrl },
    employer(40, otherUrl, 'new-doc'))).revision, 2);
  assert.equal(env.tabs.size, 1);
});

test('service worker restart preserves uncertain operation and refuses automatic resend', async () => {
  const env = harness();
  await env.open(); await env.inspectReady();
  env.setPageResponse(() => undefined);
  const first = await env.request(envelope('deliver', {
    operationId: 'profile-1', profile: { fullName: 'Example User' }, answers: {}
  }, { bindingRevision: 1 }));
  assert.equal(first.kind, 'ack');
  env.restart();
  const status = await env.request(envelope('status'));
  assert.equal(status.operations['profile-1'].state, 'dispatching');
  const replay = await env.request(envelope('deliver', {
    operationId: 'profile-1', profile: { fullName: 'Example User' }, answers: {}
  }, { bindingRevision: 1 }));
  assert.equal(replay.kind, 'snapshot');
  assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 1);
});

test('selected, confirmed, and rejected uploads remain distinct', async () => {
  const document = { kind: 'resume', documentSha256: 'a'.repeat(64), pdfSha256,
    filename: 'resume.pdf', dataUrl: pdfData };
  for (const [outcome, expectedStatus] of [
    ['selected', 'unconfirmed'], ['page_confirmed', 'page_confirmed'], ['rejected', 'needs_user']
  ]) {
    const env = harness();
    await env.open(); await env.inspectReady();
    await env.request(envelope('deliver', { operationId: 'resume-1', document }, { bindingRevision: 1 }));
    env.emit({ type: 'raven-apply-v3-result', requestId, attemptId, jobId, revision: 1,
      operationId: 'resume-1', kind: 'resume', state: outcome,
      result: { evidence: outcome === 'page_confirmed' ? 'resume.pdf attached' : outcome } }, employer(40));
    await env.tick(); await env.tick();
    const status = await env.request(envelope('status'));
    assert.equal(status.status, expectedStatus);
    assert.equal(status.documents.resume.state, outcome);
    assert.equal(status.documents.resume.evidence,
      outcome === 'page_confirmed' ? 'resume.pdf attached' : outcome);
  }
});

test('manual inspection cannot authorize profile, PDF, or cover-text delivery', async () => {
  const env = harness();
  await env.open();
  const context = await env.request({ type: 'raven-apply-v3-context', url: firstUrl }, employer(40));
  env.emit({ type: 'raven-apply-v3-inspection', requestId, attemptId, jobId,
    revision: context.revision, status: 'manual', reason: 'Sign-in required.' }, employer(40));
  await env.tick(); await env.tick();
  const status = await env.request(envelope('status'));
  assert.equal(status.status, 'needs_user');
  assert.equal(status.formReady, false);
  const document = { kind: 'resume', documentSha256: 'a'.repeat(64), pdfSha256,
    filename: 'resume.pdf', dataUrl: pdfData };
  for (const payload of [
    { operationId: 'profile-1', profile: { email: 'synthetic@example.invalid' }, answers: {} },
    { operationId: 'resume-1', document },
    { operationId: 'cover-text-1', coverLetterText: { text: 'Saved text', documentSha256: 'a'.repeat(64) } }
  ]) {
    const response = await env.request(envelope('deliver', payload, { bindingRevision: 1 }));
    assert.equal(response.ok, false);
    assert.match(response.error, /ready inspection/);
  }
  assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 0);
});

test('file outcomes do not revoke the ready form authority for profile fill', async () => {
  const document = { kind: 'resume', documentSha256: 'a'.repeat(64), pdfSha256,
    filename: 'resume.pdf', dataUrl: pdfData };
  for (const outcome of ['selected', 'page_confirmed', 'rejected']) {
    const env = harness();
    await env.open(); await env.inspectReady();
    await env.request(envelope('deliver', { operationId: 'resume-1', document }, { bindingRevision: 1 }));
    env.emit({ type: 'raven-apply-v3-result', requestId, attemptId, jobId, revision: 1,
      operationId: 'resume-1', kind: 'resume', state: outcome,
      result: { evidence: outcome } }, employer(40));
    await env.tick(); await env.tick();
    assert.equal((await env.request(envelope('status'))).formReady, true);
    const profile = await env.request(envelope('deliver', {
      operationId: 'profile-1', profile: { email: 'synthetic@example.invalid' }, answers: {}
    }, { bindingRevision: 1 }));
    assert.equal(profile.ok, true);
    assert.equal(env.sent.filter(call => call.message.type === 'raven-apply-v3-deliver').length, 2);
  }
});

test('saved cover text fills one matching field without a TDZ error', async () => {
  class TextArea {
    constructor() { this.tagName = 'TEXTAREA'; this.name = 'coverLetter'; this.id = '';
      this.maxLength = -1; this.current = ''; }
    get value() { return this.current; }
    set value(next) { this.current = next; }
    getClientRects() { return [{ width: 1, height: 1 }]; }
    getAttribute(name) { return name === 'aria-label' ? 'Cover letter' : null; }
    closest() { return null; }
    dispatchEvent() {}
  }
  const field = new TextArea();
  const document = { querySelectorAll: selector => selector === 'textarea' ? [field] : [] };
  const context = {
    RavenAssistantCore: { normalizeQuestion: value => String(value || '').toLowerCase().trim(),
      isSensitiveQuestion: () => false, detectAdapter: () => ({ id: 'generic' }),
      GENERIC: { profile: {} } },
    chrome: { runtime: { sendMessage: (message, callback) => callback(null),
      onMessage: { addListener() {} }, lastError: null } },
    document, location: { protocol: 'https:', hostname: 'jobs.example', href: firstUrl },
    HTMLTextAreaElement: TextArea, HTMLInputElement: class {},
    Event: class {}, URL, Date, Object, String, Array, RegExp, setTimeout, clearTimeout
  };
  vm.runInNewContext(adapterSource, context);
  const result = await context.RavenPrepareDom.applyOperation('coverLetterText',
    { coverLetterText: { text: 'Saved cover text', documentSha256: 'a'.repeat(64) } });
  assert.equal(result.state, 'filled');
  assert.equal(field.value, 'Saved cover text');
});

test('background revokes an in-flight operation when its document navigates', async () => {
  const env = harness();
  await env.open(); await env.inspectReady();
  await env.request(envelope('deliver', { operationId: 'profile-1',
    profile: { email: 'synthetic@example.invalid' }, answers: {} }, { bindingRevision: 1 }));
  const authority = { type: 'raven-apply-v3-authority', attemptId, jobId, revision: 1,
    operationId: 'profile-1', expectedUrl: firstUrl };
  assert.equal((await env.request(authority, employer(40))).authorized, true);
  env.navigate(40, otherUrl);
  await env.tick(); await env.tick();
  assert.equal((await env.request(authority, employer(40, otherUrl))).authorized, false);
});

test('navigation during file-input wait aborts before any file assignment', async () => {
  let available = false, assignments = 0;
  const location = { protocol: 'https:', hostname: 'jobs.example', href: firstUrl };
  const input = {
    id: '', name: 'resume', accept: 'application/pdf', parentElement: { innerText: '' },
    get files() { return []; },
    set files(value) { assignments++; },
    getAttribute: name => name === 'aria-label' ? 'Resume' : null,
    closest: () => null, dispatchEvent() {}
  };
  const document = { querySelectorAll: selector =>
    selector === 'input[type="file"]' && available ? [input] : [] };
  const global = { RavenAssistantCore: {
    normalizeQuestion: value => String(value || '').toLowerCase().trim(),
    isSensitiveQuestion: () => false, detectAdapter: () => ({ id: 'generic' }),
    GENERIC: { profile: {} }, acceptsFile: () => true
  } };
  const context = {
    globalThis: global, chrome: { runtime: { sendMessage: (message, callback) => callback(null),
      onMessage: { addListener() {} }, lastError: null } },
    document, location, URL, Date, Object, String, Array, RegExp, atob,
    HTMLTextAreaElement: class {}, HTMLInputElement: class {}, Event: class {},
    File: class { constructor(bytes, name, options) { this.name = name; this.type = options.type; } },
    DataTransfer: class { constructor() { this.items = { add() {} }; this.files = []; } },
    setTimeout: callback => { location.href = otherUrl; available = true; callback(); return 1; },
    clearTimeout() {}
  };
  vm.runInNewContext(adapterSource, context);
  const authorize = async () => location.href === firstUrl;
  authorize.local = () => location.href === firstUrl;
  const result = await global.RavenPrepareDom.applyOperation('resume',
    { document: { kind: 'resume', dataUrl: pdfData } }, authorize);
  assert.equal(result.state, 'aborted');
  assert.equal(assignments, 0);
});

test('browser content never submits and keeps version 2 adapters available', () => {
  assert.match(adapterSource, /RavenPrepareDom/);
  assert.match(contentSource, /raven-apply-v3-context/);
  assert.doesNotMatch(contentSource, /\.click\s*\(|requestSubmit\s*\(|\.submit\s*\(/);
  assert.doesNotMatch(adapterSource, /requestSubmit\s*\(|\.submit\s*\(/);
});

test('legacy v1 mailbox is absent while JSON capture and import remain wired', () => {
  assert.doesNotMatch(bridgeSource, /ravenApplicationPacket|ravenApplicationSession|raven-application-packet-saved/);
  assert.doesNotMatch(backgroundSource, /raven-application-complete/);
  assert.match(bridgeSource, /prepareCapability = "0"/);
  assert.match(bridgeSource, /raven-chatgpt-request/);
  assert.match(bridgeSource, /raven-chatgpt-result/);
  assert.match(backgroundSource, /ravenChatGptRequests/);
  assert.match(backgroundSource, /save-to-raven/);
});

function atsFixture({ hostname, selector = '', accept = 'application/pdf', existingFile = false,
  coverText = false } = {}) {
  let assignments = 0;
  const container = { innerText: '' };
  let chosen = existingFile ? [{ name: 'existing.pdf', type: 'application/pdf' }] : [];
  const input = selector ? {
    tagName: 'INPUT', type: 'file', id: 'resume', name: 'resume', accept, parentElement: container,
    get files() { return chosen; },
    set files(files) {
      assignments++;
      chosen = [...files];
      container.innerText = chosen[0]?.name + ' attached';
    },
    getAttribute: name => name === 'aria-label' ? 'Resume' : null,
    closest: () => null,
    dispatchEvent() {}
  } : null;
  class CoverTextArea {
    constructor() { this.tagName = 'TEXTAREA'; this.name = 'coverLetter'; this.id = '';
      this.maxLength = -1; this.current = ''; }
    get value() { return this.current; }
    set value(next) { this.current = next; }
    getClientRects() { return [{ width: 1, height: 1 }]; }
    getAttribute(name) { return name === 'aria-label' ? 'Cover letter' : null; }
    closest() { return null; }
    dispatchEvent() {}
  }
  const field = coverText ? new CoverTextArea() : null;
  const document = { querySelectorAll: query => {
    if (query === 'textarea') return field ? [field] : [];
    if (query === 'input[type="file"]' || query === selector) return input ? [input] : [];
    return [];
  } };
  const context = {
    chrome: { runtime: { sendMessage: (message, callback) => callback(null),
      onMessage: { addListener() {} }, lastError: null } },
    document, location: { protocol: 'https:', hostname, href: 'https://' + hostname + '/apply' },
    HTMLTextAreaElement: CoverTextArea, HTMLInputElement: class {},
    Event: class {}, File: class {
      constructor(bytes, name, options) { this.name = name; this.type = options.type; }
    },
    DataTransfer: class {
      constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; }
    },
    URL, Date, Object, String, Array, RegExp, atob, setTimeout, clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(adapterSource, context);
  return { dom: context.RavenPrepareDom, adapter: context.RavenAssistantCore.detectAdapter(hostname),
    field, assignments: () => assignments };
}

test('protocol 3 selects recognized Greenhouse, Lever, and Ashby resume inputs', async () => {
  for (const [hostname, selector, adapterId] of [
    ['boards.greenhouse.io', '#resume', 'greenhouse'],
    ['jobs.lever.co', 'input[type="file"][name="resume"]', 'lever'],
    ['jobs.ashbyhq.com', 'input[type="file"][id="_systemfield_resume"]', 'ashby']
  ]) {
    const fixture = atsFixture({ hostname, selector });
    assert.equal(fixture.adapter.id, adapterId);
    const result = await fixture.dom.applyOperation('resume',
      { document: { kind: 'resume', dataUrl: pdfData } });
    assert.equal(result.state, 'page_confirmed', hostname);
    assert.equal(fixture.assignments(), 1, hostname);
    assert.match(result.result.evidence, /Raven-resume\.pdf attached/);
  }
});

test('protocol 3 preserves an existing ATS file and leaves unsupported format manual', async () => {
  const existing = atsFixture({ hostname: 'boards.greenhouse.io', selector: '#resume', existingFile: true });
  const preserved = await existing.dom.applyOperation('resume',
    { document: { kind: 'resume', dataUrl: pdfData } });
  assert.equal(preserved.state, 'no_control');
  assert.match(preserved.result.reason, /Existing attachment preserved/);
  assert.equal(existing.assignments(), 0);

  const unsupported = atsFixture({ hostname: 'jobs.lever.co',
    selector: 'input[type="file"][name="resume"]', accept: '.docx' });
  const result = await unsupported.dom.applyOperation('resume',
    { document: { kind: 'resume', dataUrl: pdfData } });
  assert.equal(result.state, 'rejected');
  assert.match(result.result.reason, /does not accept PDF/);
  assert.equal(unsupported.assignments(), 0);
});

test('protocol 3 fills a Breezy text-only cover field without a file input', async () => {
  const fixture = atsFixture({ hostname: 'studio.breezy.hr', coverText: true });
  assert.equal(fixture.adapter.id, 'breezy');
  const result = await fixture.dom.applyOperation('coverLetterText',
    { coverLetterText: { text: 'Saved synthetic cover text', documentSha256: 'a'.repeat(64) } });
  assert.equal(result.state, 'filled');
  assert.equal(fixture.field.value, 'Saved synthetic cover text');
  assert.equal(fixture.assignments(), 0);
});


function doverFixture() {
  const form = { tagName: 'FORM' };
  const radioLabels = ['United States', 'France', 'United Kingdom', 'Ireland'];
  let selectedCountry = '';
  const scope = { innerText: 'Your location (Country) *\n' + radioLabels.join('\n'), parentElement: form,
    querySelectorAll: selector => selector === 'input[type="radio"]' ? radios : [] };
  const radios = radioLabels.map(value => {
    const label = { innerText: value, parentElement: scope };
    const radio = { type: 'radio', name: 'country-group', value, checked: false, disabled: false, form,
      labels: [label], getClientRects: () => [{ width: 1, height: 1 }],
      closest: selector => selector === 'label' ? label : null,
      getAttribute: () => null,
      click() { for (const item of radios) item.checked = item === radio; selectedCountry = value; } };
    return radio;
  });
  const autoContainer = { innerText: 'Autofill from resume\nDrag & drop or upload to autofill your application.\nUpload file', parentElement: form };
  const resumeUpload = { innerText: 'Drag and drop file or browse computer\n(PDF, 5 MB maximum)', parentElement: null };
  const resumeGroup = { innerText: 'Resume *\nDrag and drop file or browse computer\n(PDF, 5 MB maximum)', parentElement: form };
  resumeUpload.parentElement = { innerText: 'Drag and drop file or browse computer\n(PDF, 5 MB maximum)', parentElement: resumeGroup };
  const assigned = [0, 0], containers = [autoContainer, resumeUpload.parentElement];
  const makeInput = index => ({
    tagName: 'INPUT', type: 'file', name: '', id: '', accept: 'application/pdf', disabled: false,
    parentElement: containers[index], form,
    get files() { return this.currentFiles || []; },
    set files(files) { assigned[index]++; this.currentFiles = [...files]; containers[index].innerText = (containers[index].innerText || '') + '\n' + files[0]?.name + ' attached'; },
    getAttribute: name => name === 'aria-label' ? null : null,
    closest: () => null, dispatchEvent() {}
  });
  const fileInputs = [makeInput(0), makeInput(1)];
  const document = {
    body: { innerText: 'Senior 3D Artist' },
    querySelectorAll(selector) {
      if (selector === 'input[type="file"]') return fileInputs;
      if (selector === 'input[type="radio"]') return radios;
      if (selector === 'input,textarea,select') return radios;
      if (selector === 'input[type="password"]' || selector === 'iframe[src]' ||
          selector === 'a[aria-label],img[alt],[role="img"][aria-label]') return [];
      if (selector === 'input:not([type="file"]):not([type="hidden"]),textarea,select') return [];
      return [];
    },
    querySelector: () => null
  };
  const context = {
    chrome: { runtime: { sendMessage: (_message, callback) => callback(null),
      onMessage: { addListener() {} }, lastError: null } },
    document, location: { protocol: 'https:', hostname: 'app.dover.com',
      pathname: '/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47c/',
      href: 'https://app.dover.com/apply/Warpfrog/908eb274-5ac8-4d37-9b0f-5108fd12a47c/' },
    HTMLTextAreaElement: class {}, HTMLInputElement: class {}, Event: class {},
    File: class { constructor(_bytes, name, options) { this.name = name; this.type = options.type; } },
    DataTransfer: class { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } },
    URL, Date, Object, String, Array, RegExp, Map, Set, atob, setTimeout, clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(adapterSource, context);
  return { dom: context.RavenPrepareDom, assigned, get selectedCountry() { return selectedCountry; } };
}

test('Dover exact tenant route, country field, and Resume upload avoid the resume-autofill parser', async () => {
  const fixture = doverFixture();
  assert.equal(fixture.dom.inspect({ title: 'Senior 3D Artist', company: 'Warpfrog' }).status, 'ready');
  const profile = await fixture.dom.applyOperation('profile',
    { profile: { country: 'United States' }, answers: {} });
  assert.equal(profile.state, 'filled');
  assert.deepEqual(Array.from(profile.result.filled), ['country']);
  assert.equal(fixture.selectedCountry, 'United States');
  const upload = await fixture.dom.applyOperation('resume',
    { document: { kind: 'resume', dataUrl: pdfData } });
  assert.equal(upload.state, 'page_confirmed');
  assert.equal(fixture.assigned[0], 0, 'Autofill from resume input must remain untouched');
  assert.equal(fixture.assigned[1], 1, 'Resume attachment input must receive the PDF');
});
