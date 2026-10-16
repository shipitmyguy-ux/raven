import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../extension/src/apply-background.js', import.meta.url), 'utf8');
const contentSource = fs.readFileSync(new URL('../extension/src/apply-content.js', import.meta.url), 'utf8');
const adapterSource = fs.readFileSync(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8');
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

test('browser content never submits and keeps version 2 adapters available', () => {
  assert.match(adapterSource, /RavenPrepareDom/);
  assert.match(contentSource, /raven-apply-v3-context/);
  assert.doesNotMatch(contentSource, /\.click\s*\(|requestSubmit\s*\(|\.submit\s*\(/);
  assert.doesNotMatch(adapterSource, /requestSubmit\s*\(|\.submit\s*\(/);
});

test('legacy v1 mailbox is absent while JSON capture and import remain wired', () => {
  assert.doesNotMatch(bridgeSource, /ravenApplicationPacket|ravenApplicationSession|raven-application-packet-saved/);
  assert.doesNotMatch(backgroundSource, /raven-application-complete/);
  assert.match(bridgeSource, /raven-chatgpt-request/);
  assert.match(bridgeSource, /raven-chatgpt-result/);
  assert.match(backgroundSource, /ravenChatGptRequests/);
  assert.match(backgroundSource, /save-to-raven/);
});
