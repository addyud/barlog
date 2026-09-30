const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
function train(a,sid,ids,feel,feelEx,day){
 if(day)a.time(day+'T12:00:00');
 a.run(`refreshCalendarDay();S.today.sid='${sid}';S.today.selectionConfirmed=true`);
 for(const id of ids)a.run(`(()=>{const e=sess().ex.find(x=>x.id==='${id}');setTargets(e,1).forEach((t,i)=>logSet('${id}',i,t))})()`);
 if(feel)a.run(`setFeel('${feel}')`);
 for(const id of feelEx||[])a.run(`toggleFeelEx('${id}')`);
 a.run('finish()');
}
// Synchronous stand-ins for promises so wake lock and share results settle inside run().
const done=v=>({then(ok){ok&&ok(v);return this},catch(){return this}});
const failed=e=>({then(ok,no){no&&no(e);return this},catch(no){no&&no(e);return this}});

test('screen stays awake only while a workout has logged sets',()=>{
 const a=boot(),calls=[];
 const lock={release(){calls.push('release');return done()},addEventListener(){}};
 a.set('navigator',{wakeLock:{request(t){calls.push('request:'+t);return done(lock)}}});a.run(`document.visibilityState='visible'`);
 a.run('render()');assert.deepEqual(calls,[],'no lock before any set');
 a.run(`S.today.sid='B';logSet('b3',0,1);logSet('b3',1,1)`);assert.deepEqual(calls,['request:screen'],'one request per workout');
 a.run('clearDay()');assert.deepEqual(calls,['request:screen','release']);
 a.run(`logSet('b3',0,1);setFeel('clean');finish()`);assert.deepEqual(calls.slice(2),['request:screen','release'],'finishing releases');
 a.set('navigator',{wakeLock:{request(){calls.push('denied');return failed(Error('no'))}}});
 a.run(`S.today.sid='B';logSet('b3',0,1)`);assert.equal(a.run('wakeLock'),null,'a refused lock is not held');
 a.set('navigator',{});a.run('render()');
});
test('backup reminder counts sessions and days since the last backup',()=>{
 const a=boot();
 assert.equal(a.json('backupDue()').due,false,'new install with no history');
 for(let i=0;i<5;i++)train(a,'ABCD'[i%4],[['a8','b3','c3','d11finger'][i%4]],'clean');
 assert.equal(a.json('backupDue()').due,true,'five sessions and never backed up');
 assert.match(a.run('viewProgress()'),/Time for a backup/);
 a.run('markBackup()');assert.deepEqual(a.json('S.backup'),{date:'2026-09-25',count:5});
 assert.equal(a.json('backupDue()').due,false);assert.equal(a.run('backupStatus()'),'Last backup today · 0 sessions since.');
 train(a,'B',['b3'],'clean','','2026-10-10');
 const b=a.json('backupDue()');assert.equal(b.due,true,'two weeks and a session later');assert.equal(b.since,1);assert.equal(b.days,15);
 a.run('markBackup()');for(let i=0;i<7;i++)train(a,'C',['c3']);assert.equal(a.json('backupDue()').due,false);
 train(a,'C',['c3']);assert.equal(a.json('backupDue()').due,true,'eight sessions');
});
test('only a completed share or copy counts as a backup',()=>{
 const a=boot();a.set('File',class{constructor(p,n){this.name=n}});
 a.set('navigator',{share:()=>failed({name:'AbortError'}),canShare:()=>true});a.run('shareData()');assert.equal(a.run('S.backup'),undefined,'cancelled share');
 a.set('navigator',{share:()=>done(),canShare:()=>true});a.run('shareData()');assert.equal(a.run('S.backup.date'),'2026-09-25');
 const b=boot();b.set('navigator',{clipboard:{writeText:()=>done()}});b.run('copyData()');assert.equal(b.run('S.backup.count'),0);
 assert.ok(b.run(`go('data');document.getElementById('app').innerHTML`).includes('Last backup today'));
});
test('install offers the browser prompt when available and hides once installed',()=>{
 const a=boot();
 assert.match(a.run('viewInstall()'),/browser menu: Install app/);
 a.run(`installPrompt={prompt(){},userChoice:null}`);
 assert.match(a.run('viewInstall()'),/onclick="installApp\(\)"/);a.run('installApp()');assert.equal(a.run('installPrompt'),null);
 a.run(`window.matchMedia=q=>({matches:q==='(display-mode: standalone)'})`);assert.equal(a.run('viewInstall()'),'');
});
test('AI summary carries plan, sessions, check-ins, misses, step ups and maxes',()=>{
 const a=boot();
 a.run(`S.today.sid='B';logSet('b3',0,1);logSet('b3',1,1);logSet('b3',2,1);logSet('b3',3,1);logSet('b3',4,1);[0,1,2].forEach(i=>logSet('b11push',i,10));nudge('b11push',-2);setFeel('grindy');toggleFeelEx('b11push');finish()`);
 train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';stepAction('b3','accept');S.prs.hspu=[{date:'2026-09-20',value:3}]`);
 const t=a.run('coachSummary()');
 for(const want of ['CURRENT PLAN (A–D rotation; next up: C)','- Freestanding HSPU: 1×2 + 4×1, rest 180s, ladder top 2',
  '2026-09-25 B [Grindy: Push ups]','  Push ups: 10,10,8 (target 10,10,10)','2026-09-25 B [Clean]',
  'Freestanding HSPU: Stepped up 5 × 1 → 1×2 + 4×1','HSPU 3 (2026-09-20)','My question: '])assert.ok(t.includes(want),want);
 assert.ok(!t.includes('Warm up'),'prep work left out');assert.ok(!/Max /.test(t),'benchmarks are not part of the plan list');
 a.run(`S.history.push({date:'2026-01-01',sid:'A',detail:[{n:'Old',unit:'reps',sets:[1]}]})`);assert.ok(!a.run('coachSummary()').includes('2026-01-01'),'six-week window');
 let shared=null;a.set('navigator',{share:o=>{shared=o;return done()}});a.run('shareCoach()');assert.equal(shared.text,t);
 a.run(`S.planArchives=[{savedAt:'2026-09-21T05:12:17.277Z'},{savedAt:'2026-01-02T00:00:00Z'}]`);assert.ok(a.run('coachSummary()').includes('Routine changed on 2026-09-21. Sessions before'));
});
test('check-in review groups flags by exercise and suggests Reduced after two achy sessions in a week',()=>{
 const a=boot();assert.equal(a.run('viewCheckins()'),'');
 train(a,'B',['b3','b10dips'],'ache',['b10dips'],'2026-09-20');train(a,'C',['c3'],'grindy','','2026-09-21');
 assert.equal(a.json('reducedHint()'),null,'one achy session');
 train(a,'D',['d12tuck'],'ache',['d12tuck'],'2026-09-24');train(a,'A',['a8'],'clean','','2026-09-25');
 const c=a.json('checkinSummary()');assert.deepEqual([c.rated,c.clean,c.grindy,c.ache],[4,1,1,2]);
 assert.deepEqual(c.flags.Dips,{grindy:0,ache:1,last:'2026-09-20'});assert.deepEqual(c.flags['Whole session'],{grindy:1,ache:0,last:'2026-09-21'});
 assert.match(a.run('viewCheckins()'),/Rated 4 of 4 sessions · Clean 1 · Grindy 1 · Ache 2/);
 assert.equal(a.json('reducedHint()').count,2);assert.match(a.run('viewTrain(phase())'),/Ache in 2 sessions this week/);
 a.run('snoozeReduced()');assert.equal(a.json('reducedHint()'),null,'Not now holds until a new ache');
 train(a,'B',['b3'],'ache',['b3'],'2026-09-26');assert.equal(a.json('reducedHint()').count,3);
 a.run(`setTargetMode('reduced')`);assert.equal(a.json('reducedHint()'),null,'already reduced');
 a.time('2026-10-10T12:00:00');a.run(`setTargetMode('normal')`);assert.equal(a.json('reducedHint()'),null,'older aches age out');
});
console.log(`${passed} tool groups passed.`);
