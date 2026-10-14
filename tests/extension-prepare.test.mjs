import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const requestId = '12345678-1234-4234-8234-123456789abc';
const jobId = 'JT-179';
const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';

function setup() {
  const messages = [], state = {}, events = {}, calls = [];
  let tabId = 40, ready;
  const context = {
    URL, Date, JSON, Object, String, Array, RegExp, atob, console,
    chrome: {
      runtime: { lastError: null, onMessage: { addListener: fn => messages.push(fn) } },
      storage: { local: {
        get: async key => ({ [key]: state[key] }),
        set: async value => { Object.assign(state, value); calls.push('store'); }
      } },
      tabs: {
        create: (options, cb) => { calls.push('create'); events.updated?.(tabId, { url: options.url }); cb({ id: tabId, url: options.url }); },
        update: (id, options, cb) => { calls.push('update'); events.updated?.(id, { url: options.url }); cb({ id, url: options.url }); },
        onUpdated: { addListener: fn => events.updated = fn },
        onRemoved: { addListener: fn => events.removed = fn }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../extension/src/prepare-background.js', import.meta.url), 'utf8'), context);
  const request = (message, sender) => new Promise(resolve => {
    const keepAlive = messages.map(listener => listener(message, sender, resolve)).some(Boolean);
    if (!keepAlive) resolve(undefined);
  });
  return { state, calls, request, events, tabId };
}

function packet(overrides = {}) {
  return {
    version: 2, mode: 'prepare', createdAt: new Date().toISOString(), jobId,
    jobUrl: 'https://jobs.example/apply/42?source=raven', title: 'Artist', company: 'Studio',
    profile: { firstName: 'Ari', lastName: 'Lee', email: 'ari@example.test' }, answers: {}, resume: pdf, coverLetter: pdf, ...overrides
  };
}
const ravenSender = { frameId: 0, url: 'https://shipitmyguy-ux.github.io/raven/', tab: { id: 2, url: 'https://shipitmyguy-ux.github.io/raven/' } };
const employerSender = url => ({ frameId: 0, url, tab: { id: 40, url } });

test('prepare stores the packet before creating and navigating a bound tab', async () => {
  const env = setup();
  const response = await env.request({ type: 'raven-prepare-application', requestId, packet: packet() }, ravenSender);
  assert.deepEqual({ ok: response.ok, tabId: response.tabId }, { ok: true, tabId: 40 });
  assert.ok(env.calls.indexOf('store') < env.calls.indexOf('create'));
  assert.deepEqual(env.calls.slice(-3), ['store', 'update', 'store']);
  assert.equal(env.state.ravenPreparedApplications[requestId].tabId, 40);
  assert.equal(env.state.ravenPreparedApplications[requestId].initializing, false);
});

test('only the exact bound HTTPS target can retrieve a prepare packet once', async () => {
  const env = setup();
  await env.request({ type: 'raven-prepare-application', requestId, packet: packet() }, ravenSender);
  const wrongTab = await env.request({ type: 'raven-prepare-ready', url: packet().jobUrl }, { tab: { id: 41, url: packet().jobUrl } });
  assert.equal(wrongTab, null);
  const wrongPath = await env.request({ type: 'raven-prepare-ready', url: 'https://jobs.example/other' }, employerSender('https://jobs.example/other'));
  assert.equal(wrongPath, null);
  const goodUrl = 'https://jobs.example/apply/42?source=raven#form';
  const first = await env.request({ type: 'raven-prepare-ready', url: goodUrl }, employerSender(goodUrl));
  assert.equal(first.packet.jobId, jobId);
  assert.equal(await env.request({ type: 'raven-prepare-ready', url: goodUrl }, employerSender(goodUrl)), null);
});

test('Ashby opens only the observed same-job application route', async () => {
  const env = setup();
  const ashby = packet({ jobUrl: 'https://jobs.ashbyhq.com/believer/f031cf45-a4dd-40c5-8c00-b26c1c431dd8' });
  await env.request({ type: 'raven-prepare-application', requestId, packet: ashby }, ravenSender);
  const target = 'https://jobs.ashbyhq.com/believer/f031cf45-a4dd-40c5-8c00-b26c1c431dd8/application';
  const ready = await env.request({ type: 'raven-prepare-ready', url: target }, employerSender(target));
  assert.equal(ready.packet.jobUrl, ashby.jobUrl);
  const unmatched = setup();
  const other = packet({ jobUrl: 'https://jobs.ashbyhq.com/believer/job-slug' });
  await unmatched.request({ type: 'raven-prepare-application', requestId, packet: other }, ravenSender);
  const direct = await unmatched.request({ type: 'raven-prepare-ready', url: other.jobUrl }, employerSender(other.jobUrl));
  assert.equal(direct.packet.jobUrl, other.jobUrl);
});

test('Raven sender, expiry, credentials and non-PDF documents are rejected before opening tabs', async () => {
  for (const [sender, payload] of [
    [{ frameId: 0, url: 'https://evil.example/raven/', tab: { url: 'https://evil.example/raven/' } }, packet()],
    [ravenSender, packet({ createdAt: new Date(Date.now() - 6 * 60_000).toISOString() })],
    [ravenSender, packet({ jobUrl: 'https://user:pass@jobs.example/apply' })],
    [ravenSender, packet({ resume: 'data:text/plain;base64,SGk=' })]
  ]) {
    const env = setup();
    const response = await env.request({ type: 'raven-prepare-application', requestId, packet: payload }, sender);
    assert.equal(response.ok, false);
    assert.equal(env.calls.includes('create'), false);
  }
});

test('a redirect or navigation away invalidates the tab-bound packet', async () => {
  const env = setup();
  await env.request({ type: 'raven-prepare-application', requestId, packet: packet() }, ravenSender);
  env.events.updated(40, { url: 'https://jobs.example/different-job' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.state.ravenPreparedApplications[requestId], undefined);
});

test('prepare content attaches PDFs and contains no submission or navigation action', () => {
  const source = fs.readFileSync(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8');
  assert.match(source, /new DataTransfer\(\)/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /submit manually/);
  assert.doesNotMatch(source, /\.click\s*\(|requestSubmit\s*\(|\.submit\s*\(/);
});

test('Ashby preparation targets labeled application files and leaves sponsorship controls alone', async () => {
  const labels = new Map();
  const fields = [];
  const addInput = ({ id, name = '', type = 'text', label, value = '', accept = '' }) => {
    const input = {
      tagName: 'INPUT', id, name, type, value, accept, disabled: false, readOnly: false, files: [],
      getAttribute(key) { return ({ 'aria-labelledby': '', 'aria-label': label, autocomplete: '', placeholder: '', 'data-testid': '' })[key] || null; },
      closest() { return null; }, dispatchEvent(event) { if (event.type === 'change' && this.type === 'file' && this.files[0]) this.parentElement.innerText += ' ' + this.files[0].name; },
      setAttribute() {}, parentElement: { innerText: 'Upload ' + label }
    };
    labels.set(id, label); fields.push(input); return input;
  };
  addInput({ id: '_systemfield_name', label: 'Name' });
  addInput({ id: '_systemfield_email', type: 'email', label: 'Email' });
  addInput({ id: 'portfolio-id', label: 'Portfolio/website' });
  addInput({ id: 'sponsorship-radio', type: 'radio', label: 'Will you need sponsorship?' });
  const auto = addInput({ id: 'autofill-resume', name: 'resume_import', type: 'file', label: 'Autofill from resume' });
  const resume = addInput({ id: '_systemfield_resume', name: 'resume', type: 'file', label: 'Resume', accept: '.pdf' });
  const cover = addInput({ id: 'system-uuid-cover', type: 'file', label: 'Cover Letter', accept: 'application/pdf' });
  const documentRef = {
    documentElement: { appendChild() {} },
    createElement() { return { style: {}, set textContent(value) { this.text = value; } }; },
    getElementById(id) { return id === 'raven-assistant-banner' ? this.banner || null : null; },
    querySelector(selector) {
      const label = selector.match(/^label\[for="([^"]+)"\]$/)?.[1];
      return label && labels.has(label) ? { innerText: labels.get(label) } : null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith('input[type="file"]')) {
        if (selector.includes('id="_systemfield_resume"')) return [resume];
        if (selector.includes('name*="resume"')) return [auto, resume].filter(item => item.name.toLowerCase().includes('resume'));
        if (selector.includes('name*="cover"')) return [];
        if (selector.includes('id*="cover"')) return [];
        return [auto, resume, cover];
      }
      if (selector.includes('input:not(')) return fields.filter(item => item.type !== 'file' && item.type !== 'radio');
      return [];
    }
  };
  documentRef.banner = null;
  const events = [];
  class Transfer { constructor() { const list = []; this.items = { add: file => list.push(file) }; this.files = list; } }
  const context = {
    URL, Date, JSON, Object, String, Array, RegExp, atob, File, DataTransfer: Transfer, Event, CSS: { escape: value => value },
    HTMLInputElement: class {}, HTMLTextAreaElement: class {}, location: { protocol: 'https:', hostname: 'jobs.ashbyhq.com', href: 'https://jobs.ashbyhq.com/believer/id/application' },
    document: documentRef, setTimeout, clearTimeout,
    chrome: { runtime: { lastError: null, sendMessage(message, callback) { events.push(message); if (message.type === 'raven-prepare-ready') callback({ packet: packet() }); } } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../extension/src/assistant-core.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8'), context);
  await new Promise(resolve => setTimeout(resolve, 2_000));
  assert.ok(events.some(item => item.type === 'raven-prepare-result'), JSON.stringify(events));
  assert.equal(fields.find(item => item.id === '_systemfield_name').value, 'Ari Lee');
  assert.equal(fields.find(item => item.id === '_systemfield_email').value, 'ari@example.test');
  assert.equal(auto.files.length, 0);
  assert.equal(resume.files[0]?.type, 'application/pdf');
  assert.equal(cover.files[0]?.type, 'application/pdf');
  assert.ok(events.some(item => item.type === 'raven-prepare-result'));
  assert.equal(fields.find(item => item.id === 'sponsorship-radio').value, '');
});
