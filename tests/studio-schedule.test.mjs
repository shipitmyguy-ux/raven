import assert from 'node:assert/strict';
import {selectDueSources, computeNextCheck} from '../supabase/functions/_shared/studio-schedule.mjs';
const now = Date.parse('2026-10-13T00:00:00Z'), hour = 3600000;
const row = (id, overrides = {}) => ({id, enabled:true, verification_status:'verified', provider:'ashby', board_key:id, priority:2, next_check_at:new Date(now-hour).toISOString(), ...overrides});
const next = options => Date.parse(computeNextCheck(options.source || {}, {...options, now}));
const old = row('quiet', {priority:1, next_check_at:new Date(now-48*hour).toISOString()});
assert.equal(selectDueSources([row('priority', {priority:3}), old], {now,maxSources:1})[0].id,'quiet');
assert.equal(selectDueSources([row('low',{priority:1}), row('high',{priority:3})], {now,maxSources:1})[0].id,'high');
for (const override of [{enabled:false},{verification_status:'pending'},{verification_status:'blocked'},{provider:'pending'},{board_key:''},{next_check_at:'invalid'},{next_check_at:new Date(now+1).toISOString()}]) {
  assert.deepEqual(selectDueSources([row('excluded', override)], {now}),[]);
}
const many = Array.from({length:600}, (_,i) => row(String(i), {priority:i<500?1:3, next_check_at:new Date(now-(600-i)*hour).toISOString()}));
assert.deepEqual(selectDueSources(many,{now,maxSources:6}).map(s=>s.id),['0','1','2','3','4','5']);
// As processed sources move into the future, the next oldest quiet entries advance.
for (const source of selectDueSources(many,{now,maxSources:6})) source.next_check_at=new Date(now+168*hour).toISOString();
assert.deepEqual(selectDueSources(many,{now,maxSources:6}).map(s=>s.id),['6','7','8','9','10','11']);
assert.equal(selectDueSources([row('same'),row('same')],{now}).length,1);
const spread = Array.from({length:10},(_,i)=>row('a'+i)).concat(Array.from({length:10},(_,i)=>row('l'+i,{provider:'lever'})));
assert.equal(selectDueSources(spread,{now}).length,12);
assert.equal(selectDueSources(spread,{now,perProvider:2}).length,4);
assert.equal(selectDueSources([row('a',{provider:'custom-a',careers_url:'https://shared.example/a'}),row('b',{provider:'custom-b',careers_url:'https://shared.example/b'})],{now,perHost:1}).length,1);
assert.equal(selectDueSources(spread,{now,perProvider:12,perHost:2}).length,4);
assert.equal(next({status:'ok',fetched:0})-now,168*hour);
assert.equal(next({status:'ok',fetched:10,eligible:0})-now,24*hour);
assert.equal(next({status:'ok',eligible:0})-now,24*hour); // unknown fetched count is never a verified empty feed
assert.equal(next({status:'ok',fetched:0,source:{priority:3}})-now,6*hour);
for (const interval_hours of [6,24,168]) assert.equal(next({status:'ok',fetched:0,source:{interval_hours}})-now,interval_hours*hour);
for (const [failureCount,hours] of [[1,12],[2,24],[3,48],[4,96],[5,168],[1000,168]]) assert.equal(next({status:'failed',fetched:0,failureCount})-now,hours*hour);
assert.equal(next({status:'failed',source:{interval_hours:168}})-now,168*hour);
assert.equal(next({status:'failed',source:{consecutive_failures:2}})-now,48*hour);
assert.throws(()=>computeNextCheck({}, {status:'pending',now}),/completed/);
assert.throws(()=>selectDueSources([], {now:'invalid'}),/time/);
console.log('studio scheduling fairness and cadence checks passed');
