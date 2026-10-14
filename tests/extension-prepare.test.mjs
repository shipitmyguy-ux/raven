import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const requestId = '12345678-1234-4234-8234-123456789abc';
const jobId = 'JT-179';
const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';
const url = 'https://jobs.example/apply/42?source=raven';
const raven = { frameId: 0, url: 'https://shipitmyguy-ux.github.io/raven/', tab: { id: 2, url: 'https://shipitmyguy-ux.github.io/raven/' } };
const employer = (target = url, id = 40) => ({ frameId: 0, url: target, tab: { id, url: target } });
const identity = (overrides = {}) => ({ requestId, jobId, jobUrl: url, title: 'Artist', company: 'Studio', ...overrides });
const packet = (overrides = {}) => ({ version: 2, mode: 'prepare', createdAt: new Date().toISOString(),
  jobId, jobUrl: url, title: 'Artist', company: 'Studio', profile: { email: 'ari@example.test' },
  answers: {}, resume: pdf, coverLetter: pdf, ...overrides });

function setup() {
  const messages = [], state = {}, calls = [], tabs = new Map(), events = {};
  let nextTab = 40;
  const context = { URL, Date, JSON, Object, String, Array, RegExp, atob, crypto, console, setTimeout, clearTimeout,
    chrome: {
      runtime: { lastError: null, onMessage: { addListener: fn => messages.push(fn) } },
      storage: { local: { get: async key => ({ [key]: state[key] }),
        set: async value => { Object.assign(state, value); calls.push('store'); } } },
      tabs: {
        create: (options, cb) => { calls.push('create'); const tab = { id: nextTab++, url: options.url }; tabs.set(tab.id, tab); cb(tab); },
        update: (id, options, cb) => { calls.push('update'); tabs.get(id).url = options.url; events.updated?.(id, { url: options.url }); cb(tabs.get(id)); },
        get: (id, cb) => { calls.push('get'); cb(tabs.get(id)); },
        sendMessage: (id, message, options, cb) => { calls.push('send'); cb({ accepted: true }); },
        onUpdated: { addListener: fn => events.updated = fn },
        onRemoved: { addListener: fn => events.removed = fn }
      }
    } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../extension/src/prepare-background.js', import.meta.url), 'utf8'), context);
  const request = (message, sender) => new Promise(resolve => {
    const active = messages.map(listener => listener(message, sender, resolve)).some(Boolean);
    if (!active) resolve(undefined);
  });
  const emit = (message, sender) => { for (const listener of messages) listener(message, sender, () => {}); };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const preflight = (target = url, overrides = {}) => {
    const result = request({ type: 'raven-preflight-application', ...identity({ jobUrl: target, ...overrides }) }, raven);
    return result;
  };
  return { state, calls, tabs, events, request, emit, tick, preflight };
}

test('preflight opens an inspected tab before any PDF packet exists', async () => {
  const env = setup();
  const pending = env.preflight();
  await env.tick(); await env.tick();
  assert.equal(env.calls.includes('create'), true);
  assert.equal(env.calls.includes('send'), false);
  assert.equal(env.state.ravenPreparedApplications[requestId].packet, undefined);
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer());
  const result = await pending;
  assert.equal(result.status, 'ready');
  assert.match(result.preflightId, /^[0-9a-f-]{36}$/);
  assert.equal(result.tabId, 40);
  const delivered = await env.request({ type: 'raven-prepare-application', requestId,
    preflightId: result.preflightId, packet: packet() }, raven);
  assert.equal(delivered.ok, true);
  assert.equal(env.calls.filter(call => call === 'create').length, 1);
  assert.equal(env.calls.filter(call => call === 'send').length, 1);
  const duplicate = await env.request({ type: 'raven-prepare-application', requestId,
    preflightId: result.preflightId, packet: packet() }, raven);
  assert.equal(duplicate.ok, false);
});

test('login, closed and unknown form inspection stop before PDF delivery', async () => {
  for (const outcome of [
    { status: 'blocked', reason: 'Application requires sign-in.' },
    { status: 'blocked', reason: 'Listing is closed.' },
    { status: 'manual', reason: 'No recognized application controls.' }
  ]) {
    const env = setup();
    const pending = env.preflight();
    await env.tick(); await env.tick();
    env.emit({ type: 'raven-preflight-result', url, ...outcome }, employer());
    const result = await pending;
    assert.equal(result.status, outcome.status);
    assert.equal(result.ok, false);
    assert.equal(env.calls.includes('send'), false);
    assert.equal(env.state.ravenPreparedApplications[requestId], undefined);
  }
});

test('wrong tab, path, job and token cannot deliver', async () => {
  const env = setup();
  const pending = env.preflight();
  await env.tick(); await env.tick();
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer(url, 41));
  env.emit({ type: 'raven-preflight-result', url: 'https://jobs.example/other', status: 'ready' }, employer('https://jobs.example/other'));
  await env.tick();
  assert.equal(env.state.ravenPreparedApplications[requestId].stage, 'opening');
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer());
  const ready = await pending;
  for (const [token, payload] of [
    ['wrong', packet()],
    [ready.preflightId, packet({ jobId: 'OTHER' })],
    [ready.preflightId, packet({ jobUrl: 'https://jobs.example/apply/43' })]
  ]) {
    const result = await env.request({ type: 'raven-prepare-application', requestId, preflightId: token, packet: payload }, raven);
    assert.equal(result.ok, false);
  }
  assert.equal(env.calls.includes('send'), false);
});

test('navigation or closed tab invalidates same-tab delivery', async () => {
  for (const removed of [false, true]) {
    const env = setup();
    const pending = env.preflight();
    await env.tick(); await env.tick();
    env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer());
    const ready = await pending;
    if (removed) { env.tabs.delete(40); env.events.removed(40); }
    else { env.tabs.get(40).url = 'https://jobs.example/other'; env.events.updated(40, { url: 'https://jobs.example/other' }); }
    await env.tick();
    const result = await env.request({ type: 'raven-prepare-application', requestId,
      preflightId: ready.preflightId, packet: packet() }, raven);
    assert.equal(result.ok, false);
    assert.equal(env.calls.includes('send'), false);
  }
});

test('Ashby derives only the same-job application path', async () => {
  const env = setup();
  const listing = 'https://jobs.ashbyhq.com/believer/f031cf45-a4dd-40c5-8c00-b26c1c431dd8';
  const pending = env.preflight(listing);
  await env.tick(); await env.tick();
  const target = listing + '/application';
  assert.equal(env.tabs.get(40).url, target);
  env.emit({ type: 'raven-preflight-result', url: target, status: 'ready' }, employer(target));
  const ready = await pending;
  const result = await env.request({ type: 'raven-prepare-application', requestId, preflightId: ready.preflightId,
    packet: packet({ jobUrl: listing }) }, raven);
  assert.equal(result.ok, true);
});

test('explicit retry with the same durable request ID replaces the old tab binding', async () => {
  const env = setup();
  const firstPending = env.preflight();
  await env.tick(); await env.tick();
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer());
  const first = await firstPending;
  const secondPending = env.preflight();
  await env.tick(); await env.tick();
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer(url, 41));
  const second = await secondPending;
  assert.notEqual(first.preflightId, second.preflightId);
  const stale = await env.request({ type: 'raven-prepare-application', requestId, preflightId: first.preflightId, packet: packet() }, raven);
  assert.equal(stale.ok, false);
  const fresh = await env.request({ type: 'raven-prepare-application', requestId, preflightId: second.preflightId, packet: packet() }, raven);
  assert.equal(fresh.ok, true);
  assert.equal(fresh.tabId, 41);
});
test('lost delivery acknowledgement reuses completed tab and never delivers twice',async()=>{
 const env=setup(),pending=env.preflight();await env.tick();await env.tick();
 env.emit({type:'raven-preflight-result',url,status:'ready'},employer());
 const ready=await pending;
 assert.equal((await env.request({type:'raven-prepare-application',requestId,preflightId:ready.preflightId,packet:packet()},raven)).ok,true);
 const repeated=await env.preflight();
 assert.equal(repeated.alreadyPrepared,true);assert.equal(repeated.tabId,40);
 assert.equal(env.calls.filter(call=>call==='create').length,1);
 assert.equal(env.calls.filter(call=>call==='send').length,1);
 env.emit({type:'raven-prepare-result',result:{}},employer());await env.tick();
 assert.equal(env.state.ravenPreparedApplications[requestId].stage,'complete');
 const afterResult=await env.preflight();assert.equal(afterResult.alreadyPrepared,true);
 assert.equal(env.calls.filter(call=>call==='create').length,1);
 assert.equal(env.calls.filter(call=>call==='send').length,1);
});
test('uncertain delivery stops for manual inspection without a second tab',async()=>{
 const env=setup(),pending=env.preflight();await env.tick();await env.tick();
 env.emit({type:'raven-preflight-result',url,status:'ready'},employer());await pending;
 env.state.ravenPreparedApplications[requestId].stage='delivering';
 const result=await env.preflight();assert.equal(result.status,'manual');
 assert.equal(env.calls.filter(call=>call==='create').length,1);
 assert.equal(env.calls.filter(call=>call==='send').length,0);
});

test('untrusted source and invalid PDF are rejected without dispatch', async () => {
  const env = setup();
  const bad = await env.request({ type: 'raven-preflight-application', ...identity() },
    { frameId: 0, url: 'https://evil.example/raven/', tab: { url: 'https://evil.example/raven/' } });
  assert.equal(bad.ok, false);
  assert.equal(env.calls.includes('create'), false);
  const pending = env.preflight();
  await env.tick(); await env.tick();
  env.emit({ type: 'raven-preflight-result', url, status: 'ready' }, employer());
  const ready = await pending;
  const result = await env.request({ type: 'raven-prepare-application', requestId, preflightId: ready.preflightId,
    packet: packet({ resume: 'data:text/plain;base64,SGk=' }) }, raven);
  assert.equal(result.ok, false);
  assert.equal(env.calls.includes('send'), false);
});
test('only the inspected top frame may clear a delivered preparation',async()=>{
 const env=setup(),pending=env.preflight();await env.tick();await env.tick();
 env.emit({type:'raven-preflight-result',url,status:'ready'},employer());
 const ready=await pending;
 assert.equal((await env.request({type:'raven-prepare-application',requestId,preflightId:ready.preflightId,packet:packet()},raven)).ok,true);
 env.emit({type:'raven-prepare-result',result:{}},{...employer(),frameId:1});await env.tick();
 assert.ok(env.state.ravenPreparedApplications[requestId]);
 env.emit({type:'raven-prepare-result',result:{}},employer('https://jobs.example/other'));await env.tick();
 assert.ok(env.state.ravenPreparedApplications[requestId]);
 env.emit({type:'raven-prepare-result',result:{}},employer());await env.tick();
 assert.equal(env.state.ravenPreparedApplications[requestId].stage,'complete');
});

test('content never submits or clicks navigation', () => {
  const source = fs.readFileSync(new URL('../extension/src/prepare-content.js', import.meta.url), 'utf8');
  assert.match(source, /raven-preflight-result/);
  assert.match(source, /raven-prepare-deliver/);
  assert.match(source, /new DataTransfer\(\)/);
  assert.doesNotMatch(source, /\.click\s*\(|requestSubmit\s*\(|\.submit\s*\(/);
});
