const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
function legacy(){
 const a=boot(),s=a.json('S');delete s.calendar;delete s.targetMode;
 s.planArchives=[];s.week=1;s.rot=14;s.today={date:'2026-09-25',sid:'C',log:{},band:{},rice:true};
 const dates=['2026-08-18','2026-08-20','2026-08-23','2026-08-25','2026-08-29','2026-08-31','2026-09-06','2026-09-09','2026-09-12','2026-09-18','2026-09-21','2026-09-23','2026-09-23','2026-09-24'];
 s.history=dates.map((date,i)=>({date,sid:'ABCD'[i%4],week:i>9?1:3,detail:[{n:'Sample exercise',unit:'reps',sets:[1]}]})).reverse();
 return s;
}
test('sparse history: continuous week 6, correct current rotation, all original records preserved',()=>{
 const original=legacy(),a=boot(original),s=a.json('S');
 assert.equal(s.calendar.startDate,'2026-08-18');assert.equal(a.run("calendarWeek('2026-09-25')"),6);
 for(const key of ['history','prs','rot','today','planArchives'])assert.deepEqual(s[key],original[key]);
 assert.equal(a.run('nextId()'),'C');assert.equal(s.targetMode,'normal');
 const again=boot(s);assert.deepEqual(again.json('S'),s);
 assert.ok(a.run('viewHistory()').includes('Week 6'));a.run('openHist=0');assert.ok(a.run('viewHistory()').includes('Original logged label: week 1'));
 const exported=JSON.parse(a.run('snapshot()'));assert.equal(exported.week,6);assert.deepEqual(exported.history,original.history);
});
test('week boundaries are seven calendar days, with DST, leap days, invalid dates and no week-eight reset',()=>{
 const a=boot();
 for(const [start,date,w] of [['2026-08-18','2026-08-24',1],['2026-08-18','2026-08-25',2],['2026-03-07','2026-03-14',2],['2026-10-31','2026-11-07',2],['2028-02-25','2028-03-03',2],['2026-08-18','2026-10-13',9]])assert.equal(a.run(`calendarWeek('${date}','${start}')`),w);
 for(const d of ['2026-02-30','2026-13-01','bad','2026-2-3'])assert.equal(a.run(`dateNumber('${d}')`),null);
 assert.equal(a.run("calendarWeek('2026-08-17','2026-08-18')"),null);
 assert.ok(!a.run("viewCalendar()").includes("calendarStart"));
});
test('routine adoption, archive restore, export and import keep the calendar and target mode',()=>{
 const a=boot(legacy());a.run("setTargetMode('reduced')");const cal=a.json('S.calendar'),hist=a.json('S.history');
 a.run('switchPlan();restorePlan(0)');assert.deepEqual(a.json('S.calendar'),cal);assert.deepEqual(a.json('S.history'),hist);assert.equal(a.run('S.targetMode'),'reduced');
 a.set('backup',a.run('snapshot()'));a.run('S=blank();applyBackup(backup)');assert.deepEqual(a.json('S.calendar'),cal);assert.deepEqual(a.json('S.history'),hist);assert.equal(a.run('S.targetMode'),'reduced');
});
test('legacy week-four reduction stays selected; all future calendar weeks keep explicit target choice',()=>{
 const s=legacy();s.week=4;const a=boot(s);assert.equal(a.run('S.targetMode'),'reduced');
 assert.equal(a.run('setsFor(S.plan[0].ex[2],9)'),3);a.run("setTargetMode('normal')");assert.equal(a.run('setsFor(S.plan[0].ex[2],4)'),5);
});
test('an overnight unfinished workout keeps its original date and calendar week',()=>{
 const s=legacy();s.today={date:'2026-09-21',sid:'C',log:{c3:[5]},band:{},rice:false};const a=boot(s);
 a.run('finish()');assert.equal(a.run('S.history[0].date'),'2026-09-21');assert.equal(a.run('S.history[0].week'),5);assert.equal(a.run('S.history[0].weekSource'),'calendar');assert.equal(a.run('nextId()'),'D');
});
test('an idle app advances the calendar after midnight, without losing a draft or changing targets',()=>{
 const a=boot(legacy(),'2026-09-28T12:00:00');a.run("S.today.date=dayKey();S.today.log={c3:[5]}");const draft=a.json('S.today');
 a.time('2026-09-29T12:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('calendarWeek(dayKey())'),7);assert.deepEqual(a.json('S.today'),draft);assert.equal(a.run('S.targetMode'),'normal');
 a.run('S.today.log={};render()');assert.equal(a.run('S.today.date'),a.run('dayKey()'));
});
test('backfill derives week from date, does not move rotation by default, and retains a current draft',()=>{
 const a=boot(legacy());a.run("S.today.log={c3:[5]};bfSid='B';bfDate='2026-08-31';bfLog={b3:[1]}");
 const draft=a.json('S.today');assert.equal(a.run('bfAdvOn()'),false);a.run('addPast()');assert.equal(a.run('S.history[0].week'),2);assert.equal(a.run('S.rot'),14);assert.deepEqual(a.json('S.today'),draft);
 a.run("bfSid='D';bfDate='2026-09-24';bfAdv=true;bfLog={d12tuck:[3]};addPast()");assert.deepEqual(a.json('S.today'),draft);
});
test('date correction relabels calendar without rewriting original legacy labels or set records',()=>{
 const a=boot(legacy());const detail=a.json('S.history[0].detail');a.run("setHistDate(0,'2026-09-02')");assert.equal(a.run('calendarWeek(S.history[0].date)'),3);assert.equal(a.run('S.history[0].week'),1);assert.deepEqual(a.json('S.history[0].detail'),detail);
 a.run("S.history[0].weekSource='calendar';setHistDate(0,'2026-09-10')");assert.equal(a.run('S.history[0].week'),4);
});
test('finishing an out-of-order session follows the completed letter, benchmark does not rotate, empty finish is ignored',()=>{
 const a=boot(legacy());a.run("S.today.sid='D';S.today.log={d12tuck:[3]};finish()");assert.equal(a.run('nextId()'),'A');
 const rot=a.run('S.rot'),n=a.run('S.history.length');a.run('finish()');assert.equal(a.run('S.history.length'),n);
 a.run("S.today.sid='T';S.today.log={t3:[1]};finish()");assert.equal(a.run('S.rot'),rot);
});
test('backfill target choice cannot change the live workout targets',()=>{
 const a=boot(legacy());a.run("setBfTargets('reduced')");assert.equal(a.run('S.targetMode'),'normal');assert.equal(a.run('bfTargetMode'),'reduced');
 a.run("setTargetMode('reduced');setBfTargets('normal')");assert.equal(a.run('S.targetMode'),'reduced');
});
test('failed storage saves roll back target changes',()=>{
 const a=boot(legacy()),before=a.json('S');a.fail(true);a.run("setTargetMode('reduced')");assert.deepEqual(a.json('S'),before);
});
console.log(`${passed} calendar groups passed.`);
