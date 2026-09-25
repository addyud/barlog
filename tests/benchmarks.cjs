const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
test('blank results replace benchmark targets in Train and backfill',()=>{
 const a=boot();a.run("pickSession('T');confirmSessionChange()");
 for(const html of [a.run('viewTrain(phase())'),a.run("viewBfExercises('T',1)")]){
  assert.equal((html.match(/placeholder="Your result" value=""/g)||[]).length,5);
  assert.ok(!/onclick="(?:bfLogSet|logSet)\('t[23768]'/.test(html));
 }
 assert.ok(!a.run('viewCalendar()').includes('Calendar start'));
});
test('entered results persist exactly and finish records actual PRs without rotating',()=>{
 const a=boot();a.run("pickSession('T');confirmSessionChange();recordBenchmark('t7',0,'12.5',false);recordBenchmark('t3',0,'8',false)");
 assert.equal(a.elements.get('finishSession').disabled,false);
 const b=boot(JSON.parse(a.store.get('barlog.v1'))),rot=b.run('S.rot');
 assert.deepEqual(b.json('S.today.log'),{t7:[12.5],t3:[8]});
 b.run('finish()');assert.equal(b.run('S.prs.fingertip[0].value'),12.5);assert.equal(b.run('S.prs.hspu[0].value'),8);
 assert.equal(b.run('S.history[0].secs'),12.5);assert.equal(b.run('S.history[0].reps'),8);assert.equal(b.run('S.rot'),rot);
});
test('clear and invalid entries cannot leave a stale benchmark value; zero is a valid result',()=>{
 const a=boot();a.run("pickSession('T');confirmSessionChange()");
 for(const input of ['', '-1','NaN','Infinity','1.5']){
  a.run(`recordBenchmark('t3',0,'8',false);recordBenchmark('t3',0,${JSON.stringify(input)},false)`);
  assert.deepEqual(a.json('S.today.log.t3'),[null]);assert.equal(a.elements.get('finishSession').disabled,true);
 }
 a.run("recordBenchmark('t3',0,'0',false);finish()");assert.equal(a.run('S.prs.hspu[0].value'),0);
});
test('backfill preserves actual seconds and reps, leaves live draft and rotation untouched',()=>{
 const a=boot();const draft=a.json('S.today'),rot=a.run('S.rot');
 a.run("bfSid='T';bfDate='2026-09-24';recordBenchmark('t8',0,'7.5',true);recordBenchmark('t2',0,'14',true);addPast()");
 assert.equal(a.run('S.history[0].secs'),7.5);assert.equal(a.run('S.history[0].reps'),14);assert.equal(a.run('S.prs.planche[0].value'),7.5);
 assert.deepEqual(a.json('S.today'),draft);assert.equal(a.run('S.rot'),rot);
});
test('failed save preserves prior benchmark log',()=>{
 const a=boot();a.run("pickSession('T');confirmSessionChange();recordBenchmark('t3',0,'3',false)");const before=a.json('S.today.log');
 a.fail(true);a.run("recordBenchmark('t3',0,'8',false)");assert.deepEqual(a.json('S.today.log'),before);
});
test('copy migration preserves calendar, custom notes, plans and historical results',()=>{
 const a=boot(),saved=a.json('S');delete saved.benchmarkEntryVersion;
 saved.calendar={startDate:'2026-08-18',source:'earliest-log'};
 saved.plan.find(p=>p.id==='T').ex.find(e=>e.id==='t3').note='Personal instructions';
 saved.history=[{sid:'T',date:'2026-09-01',detail:[{id:'t3',sets:[7],unit:'reps'}]}];saved.prs.hspu=[{date:'2026-09-01',value:7}];
 const b=boot(saved);
 for(const key of ['calendar','plan','history','prs','today'])assert.deepEqual(b.json('S.'+key),saved[key]);
});
console.log(`${passed} benchmark groups passed.`);
