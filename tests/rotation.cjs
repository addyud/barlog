const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
test('current workout leads Train; all alternate sessions are behind Change workout',()=>{
 const a=boot(),html=a.run('viewTrain(phase())');
 assert.ok(html.indexOf('Current workout')<html.indexOf('Calendar'));
 const choices=html.split('<details class="workoutChoice">')[1].split('</details>')[0];
 assert.ok(choices.includes('Change workout'));assert.equal((choices.match(/onclick="pickSession/g)||[]).length,5);
 assert.equal((html.replace(choices,'').match(/onclick="pickSession/g)||[]).length,0);
});
test('cancel and invalid selections leave the entire state and running rest timer intact',()=>{
 const a=boot();a.run("startRest(90,'existing')");const before=a.json('S'),timer=a.json('timer');
 a.run("pickSession('C');cancelSessionChange();pickSession('unknown')");assert.equal(a.run("pendingSession"),null);
 assert.deepEqual(a.json('S'),before);assert.deepEqual(a.json('timer'),timer);
});
test('confirmed override survives rest days and midnight without moving rotation',()=>{
 const a=boot();a.run("pickSession('B');confirmSessionChange()");assert.equal(a.run('S.today.sid'),'B');assert.equal(a.run('S.rot'),0);
 const b=boot(a.json('S'),'2026-09-28T12:00:00');assert.equal(b.run('S.today.sid'),'B');assert.equal(b.run('S.today.date'),'2026-09-28');
 b.run("logSet('b3',0,1)");b.time('2026-09-29T12:00:00');b.run('refreshCalendarDay();finish()');
 assert.equal(b.run('S.history[0].date'),'2026-09-28');assert.equal(b.run('S.history[0].sid'),'B');assert.equal(b.run('S.today.sid'),'C');assert.equal(b.run('nextId()'),'C');
});
test('in-progress sessions cannot be relabeled or lose their draft through selection',()=>{
 const a=boot();let asked=0;a.set('confirm',()=>{asked++;return true});
 a.run("logSet('a8',0,6)");const before=a.json('S'),timer=a.json('timer');
 a.run("pickSession('B');confirmSessionChange();pickSession('T')");assert.equal(asked,0);assert.deepEqual(a.json('S'),before);assert.deepEqual(a.json('timer'),timer);
});
test('empty legacy selection follows rotation; any logged legacy draft is preserved',()=>{
 const a=boot(),old=a.json('S');old.rot=2;old.today.sid='B';
 assert.equal(boot(old).run('S.today.sid'),'C');old.today.log={b3:[1]};
 const resumed=boot(old);assert.deepEqual(resumed.json('S.today'),old.today);
});
test('failed selection and completion saves preserve both workout and next letter',()=>{
 const a=boot();let before=a.json('S');a.fail(true);a.run("pickSession('B');confirmSessionChange()");assert.deepEqual(a.json('S'),before);
 a.fail(false);a.run("pickSession('B');confirmSessionChange();logSet('b3',0,1)");before=a.json('S');const stored=a.store.get('barlog.v1');
 a.fail(true);a.run('finish()');assert.deepEqual(a.json('S'),before);assert.equal(a.store.get('barlog.v1'),stored);
 a.fail(false);a.run('finish()');assert.equal(a.run('S.history.length'),1);assert.equal(a.run('S.today.sid'),'C');
});
test('benchmark access is confirmed and finishing returns to the expected rotation workout',()=>{
 const a=boot();a.run("pickSession('T')");assert.match(a.run('viewTrain(phase())'),/will not advance/);assert.equal(a.run('S.today.sid'),'A');a.run('confirmSessionChange()');
 a.run("recordBenchmark('t3',0,'2',false);finish()");assert.equal(a.run('S.today.sid'),'A');assert.equal(a.run('S.rot'),0);
});
console.log(`${passed} rotation groups passed.`);
