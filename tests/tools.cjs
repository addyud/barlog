const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
function train(a,sid,ids,feel,feelEx,day){
 if(day)a.time(day+'T12:00:00');
 a.run(`refreshCalendarDay();S.today.sid='${sid}';S.today.selectionConfirmed=true;S.today.maxTest=false`);
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
 a.run(`S.today.sid='B';S.today.maxTest=false;logSet('b3',0,1);logSet('b3',1,1)`);assert.deepEqual(calls,['request:screen'],'one request per workout');
 a.run('clearDay()');assert.deepEqual(calls,['request:screen','release']);
 a.run(`logSet('b3',0,1);setFeel('clean');finish()`);assert.deepEqual(calls.slice(2),['request:screen','release'],'finishing releases');
 a.set('navigator',{wakeLock:{request(){calls.push('denied');return failed(Error('no'))}}});
 a.run(`S.today.sid='B';S.today.maxTest=false;logSet('b3',0,1)`);assert.equal(a.run('wakeLock'),null,'a refused lock is not held');
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
test('backups share as a plain-text file; a refused share saves the file instead',()=>{
 const a=boot();a.set('File',class{constructor(p,n,o){this.name=n;this.type=o&&o.type}});
 let shared=null,downloads=0;a.set('URL',{createObjectURL:()=>'blob:x',revokeObjectURL(){}});a.set('Blob',class{});
 a.run(`document.createElement=()=>({style:{},remove(){},click(){globalThis.dl=(globalThis.dl||0)+1}})`);
 a.set('navigator',{share:o=>{shared=o;return failed({name:'AbortError'})},canShare:o=>o.files[0].type==='text/plain'&&/\.txt$/.test(o.files[0].name)});
 a.run('shareData()');assert.equal(shared.files[0].name,'barlog-2026-09-25.txt');assert.equal(a.run('S.backup'),undefined,'cancelled share');assert.equal(a.run('globalThis.dl')||0,0,'cancelling does not download');
 a.set('navigator',{share:()=>done(),canShare:()=>true});a.run('shareData()');assert.equal(a.run('S.backup.date'),'2026-09-25');
 a.set('navigator',{share:()=>failed(new TypeError('Permission denied')),canShare:()=>true});a.run('shareData()');assert.equal(a.run('globalThis.dl'),1,'a refused share downloads the file');
 a.set('navigator',{share:()=>done(),canShare:()=>false});a.run('shareData()');assert.equal(a.run('globalThis.dl'),2,'no file sharing downloads too');
 const b=boot();b.set('navigator',{clipboard:{writeText:()=>done()}});b.run('copyData()');assert.equal(b.run('S.backup.count'),0);
 assert.ok(b.run(`go('data');document.getElementById('app').innerHTML`).includes('Last backup today'));
 b.set('backupText',b.run('snapshot()'));b.run('wipe();applyBackup(backupText)');assert.equal(b.run('S.backup.count'),0,'the shared text restores like a .json backup');
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
 a.run(`S.today.sid='B';S.today.maxTest=false;logSet('b3',0,1);logSet('b3',1,1);logSet('b3',2,1);logSet('b3',3,1);logSet('b3',4,1);[0,1,2].forEach(i=>logSet('b11push',i,10));nudge('b11push',-2);setFeel('grindy');toggleFeelEx('b11push');finish()`);
 train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b3','accept');S.prs.hspu=[{date:'2026-09-20',value:3}]`);
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
 assert.equal(a.json('reducedHint()').count,2);assert.match(a.run('viewTrain(phase())'),/Ache or too sore after 2 sessions this week/);
 a.run('snoozeReduced()');assert.equal(a.json('reducedHint()'),null,'Not now holds until a new ache');
 train(a,'B',['b3'],'ache',['b3'],'2026-09-26');assert.equal(a.json('reducedHint()').count,3);
 a.run(`setTargetMode('reduced')`);assert.equal(a.json('reducedHint()'),null,'already reduced');
 a.time('2026-10-10T12:00:00');a.run(`setTargetMode('normal')`);assert.equal(a.json('reducedHint()'),null,'older aches age out');
});
test('light session is a per-workout switch near Finish that turns itself off',()=>{
 const a=boot();a.run(`S.today.sid='B';S.today.maxTest=false`);
 let html=a.run('viewTrain(phase())');
 assert.ok(!html.includes('Workout targets'),'no sticky toggle at the top');
 assert.ok(html.indexOf('Light session today')>html.indexOf('Rice bag wrists')&&html.indexOf('Light session today')<html.indexOf('finishSession'),'sits after the exercises, before Finish');
 assert.match(html,/role="switch" aria-checked="false" onclick="setTargetMode\('reduced'\)"/);
 assert.equal(a.run('phase().l'),'Full session');
 a.run(`setTargetMode('reduced')`);assert.equal(a.run('S.lightDate'),'2026-09-25');assert.equal(a.run('phase().l'),'Light session');
 assert.equal(a.run(`setTargets(sess().ex.find(e=>e.id==='b11push'),1).length`),2,'about 60% of the sets');
 a.run(`logSet('b3',0,1);setFeel('clean');finish()`);
 assert.equal(a.run('S.history[0].targetMode'),'reduced');assert.equal(a.run('S.targetMode'),'normal','off after finishing');assert.equal(a.run('S.lightDate'),undefined);
 a.run(`setTargetMode('reduced')`);a.time('2026-09-26T08:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('S.targetMode'),'normal','unused light session ends with the day');
 a.run(`setTargetMode('reduced');S.today.sid='C';S.today.maxTest=false;logSet('c3',0,5)`);a.time('2026-09-27T01:00:00');a.run('refreshCalendarDay()');
 assert.equal(a.run('S.targetMode'),'reduced','a workout in progress over midnight stays light');
 a.run(`pickSession('T')`);a.run(`S.today.log={};S.today.sid='T'`);assert.ok(!a.run('viewTrain(phase())').includes('Light session today'),'not on benchmarks');
 const legacy=a.json('S');legacy.targetMode='reduced';delete legacy.lightDate;legacy.today={date:'2026-09-20',sid:'A',log:{},band:{},rice:false};
 const b=boot(legacy,'2026-09-28T08:00:00');assert.equal(b.run('S.targetMode'),'reduced','older sticky reduced lasts until the next finish');
 b.run(`S.today.sid='A';S.today.maxTest=false;logSet('a8',0,6);finish()`);assert.equal(b.run('S.targetMode'),'normal');
 const c=boot();const before=c.json('S');c.fail(true);c.run(`setTargetMode('reduced')`);assert.deepEqual(c.json('S'),before);
});
test('light sessions read clearly in history, backfill, suggestions and the AI summary',()=>{
 const a=boot();a.run(`setTargetMode('reduced');S.today.sid='B';S.today.maxTest=false;logSet('b3',0,1);finish();openHist=0`);
 assert.match(a.run('viewHistory()'),/<div class="note">Light session<\/div>/);
 assert.match(a.run('coachSummary()'),/2026-09-25 B light session \[not rated\]/);
 train(a,'C',['c3'],'ache',['c3'],'2026-09-26');train(a,'D',['d11finger'],'ache',['d11finger'],'2026-09-27');
 assert.match(a.run('viewTrain(phase())'),/Make today a light session\?.*Make today light/s);
});
test('wrist break dims palms-down work, keeps it loggable, and leaves ladders untouched',()=>{
 const a=boot();a.run(`S.today.sid='B';S.today.maxTest=false`);
 let html=a.run('viewTrain(phase())');
 assert.ok(html.indexOf('Wrist break today')<html.indexOf('Light session today'),'switch sits with the light session');
 assert.ok(!html.includes('wristOff'));
 a.run('setWristBreak(true)');html=a.run('viewTrain(phase())');
 assert.match(html,/<div class="ex wristOff"><div class="exTop"><div class="exN">Freestanding HSPU/);
 assert.match(html,/Wrist break: Do these on the bars, with a neutral wrist\./);
 assert.match(html,/<div class="ex wristOff"><div class="exTop"><div class="exN">Push ups/);
 assert.ok(!/<div class="ex wristOff"><div class="exTop"><div class="exN">(Dips|Freestanding deficit|Band external)/.test(html),'bar and band work untouched');
 assert.match(html,/aria-checked="true" onclick="setWristBreak\(false\)"/);
 // Palms-down work can still be logged (bar version), but it does not count toward its ladder.
 a.run(`[0,1,2,3,4].forEach(i=>logSet('b3',i,1));[0,1].forEach(i=>logSet('b12er',i,15));setFeel('clean');finish()`);
 assert.equal(a.run('S.history[0].wristBreak'),true);assert.equal(a.run('S.today.wristBreak'),undefined,'off after finishing');
 const p=a.json(`sessionProgress(S.plan.find(x=>x.id==='B'))`);
 assert.equal(p.b3.streak,0,'HSPU on bars does not count');assert.equal(p.b12er.kind,'up','band rotations count as usual');
 assert.match(a.run(`S.today.sid='B';S.today.maxTest=false;viewTrain(phase())`),/Last 25\/09<\/span> 1, 1, 1, 1, 1 <span>· wrist break<\/span>/);
 a.run(`stepAction('b12er','accept')`);a.run(`S.today.sid='A';S.today.maxTest=false;logSet('a8',0,6);finish()`);
 // A pending change on a palms-down exercise survives a wrist-break session of that workout.
 a.run(`S.today.sid='B';S.today.maxTest=false;[0,1,2,3,4].forEach(i=>logSet('b3',i,1));setFeel('clean');finish()`);
 a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b3','accept');setWristBreak(true);[0,1,2,3,4].forEach(i=>logSet('b3',i,1));finish()`);
 assert.equal(a.run('S.progress.pending.B.id'),'b3','not trained on the floor yet');
 a.run(`S.today.sid='B';S.today.maxTest=false;setWristBreak(true);[0,1].forEach(i=>logSet('b12er',i,15));finish()`);
 assert.equal(a.run('S.progress.pending.B.id'),'b3','a wrist-break session without the exercise does not clear it either');
 a.run(`S.today.sid='B';S.today.maxTest=false;[0,1,2,3,4].forEach(i=>logSet('b3',i,1));finish()`);
 assert.equal(a.run('S.progress.pending.B'),undefined,'cleared once a session without the break happens');
});
test('wrist break resets with the day, shows in history, review and summary, and is editable',()=>{
 const a=boot();a.run(`S.today.sid='D';S.today.maxTest=false;setWristBreak(true)`);a.time('2026-09-26T08:00:00');a.run('refreshCalendarDay()');
 assert.equal(a.run('S.today.wristBreak'),undefined,'an unused break ends with the day');
 a.run(`setWristBreak(true);logSet('d13support',0,15)`);a.time('2026-09-27T01:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('S.today.wristBreak'),true,'a draft over midnight keeps it');
 a.run('clearDay()');assert.equal(a.run('S.today.wristBreak'),undefined);
 a.run(`setWristBreak(true);logSet('d13support',0,15);logSet('d14er',0,15);setFeel('clean');finish();openHist=0`);
 assert.match(a.run('viewHistory()'),/Full session · Clean · Wrist break/);
 assert.match(a.run('viewCheckins()'),/Ache 0 · Wrist break 1/);
 assert.match(a.run('coachSummary()'),/2026-09-27 D wrist break \[Clean\]/);
 a.run(`editField('D','d13support','wrist',true)`);assert.equal(a.run(`S.plan[3].ex.find(e=>e.id==='d13support').wrist`),true);
 assert.match(a.run(`S.today.sid='D';S.today.maxTest=false;setWristBreak(true);viewTrain(phase())`),/Ring support hold.*Wrist break: Skip today\./s);
 a.run(`editField('D','d13support','wrist',false)`);assert.equal(a.run(`S.plan[3].ex.find(e=>e.id==='d13support').wrist`),undefined);
 const before=a.json('S');a.fail(true);a.run('setWristBreak(false)');assert.deepEqual(a.json('S'),before);
});
test('wrist cues are added once to saved default exercises and respect renames and removals',()=>{
 const a=boot();const saved=a.json('S');delete saved.wristCuesVersion;
 for(const p of saved.plan)for(const e of p.ex)delete e.wrist;
 saved.plan[1].ex.find(e=>e.id==='b11push').n='Diamond push ups';
 const b=boot(saved);assert.equal(b.run('S.wristCuesVersion'),1);
 assert.equal(b.run(`S.plan[1].ex.find(e=>e.id==='b3').wrist`),'Do these on the bars, with a neutral wrist.');
 assert.equal(b.run(`S.plan[1].ex.find(e=>e.id==='b11push').wrist`),undefined,'renamed exercise untouched');
 assert.equal(b.run(`S.plan[1].ex.find(e=>e.id==='b10dips').wrist`),undefined);
 const later=b.json('S');delete later.plan[3].ex.find(e=>e.id==='d12tuck').wrist;
 assert.equal(boot(later).run(`S.plan[3].ex.find(e=>e.id==='d12tuck').wrist`),undefined,'a deliberate removal sticks');
});
test('a due max is scheduled after the warm-up, runs that exercise light, and can be switched off or changed',()=>{
 const a=boot();a.run(`S.today.sid='B'`);
 let html=a.run('viewTrain(phase())');
 assert.match(html,/Test a max today<\/span><span class="dailyS">Due: HSPU, no max recorded yet\. Goes in after the warm-up; Freestanding HSPU runs light today/);
 const order=html.match(/<div class="exN">([^<]*)<\/div>/g).map(x=>x.replace(/<[^>]*>/g,''));
 assert.deepEqual(order.slice(0,3),['Wrist and shoulder prep','Max HSPU · test','Freestanding HSPU']);
 assert.match(html,/Light today after the max: 3 × 1\. Doesn’t count toward the ladder\./);
 assert.equal((html.match(/logSet\('b3',/g)||[]).length,3);assert.equal((html.match(/logSet\('b11push',/g)||[]).length,3,'other exercises at full dose');
 a.run(`recordBenchmark('t3',0,'4',false)`);assert.deepEqual(a.json('S.today.log.t3'),[4]);
 assert.match(a.run('viewTrain(phase())'),/<button id="finishSession" class="btn"  onclick/,'a max alone enables Finish');
 a.run(`[0,1,2].forEach(i=>logSet('b3',i,1));[0,1].forEach(i=>logSet('b12er',i,15));setFeel('clean');finish()`);
 assert.deepEqual(a.json('S.prs.hspu'),[{date:'2026-09-25',value:4}]);assert.equal(a.run('S.history[0].maxTest'),'hspu');
 assert.equal(a.run(`S.history[0].detail.find(x=>x.id==='t3').sets[0]`),4);
 const p=a.json(`sessionProgress(S.plan.find(x=>x.id==='B'))`);assert.equal(p.b3.streak,0,'the max day does not count');assert.equal(p.b12er.kind,'up');
 html=a.run(`S.today.sid='B';viewTrain(phase())`);
 assert.match(html,/Last 25\/09<\/span> 1, 1, 1 <span>· max day<\/span>/);assert.match(html,/Nothing due\. HSPU: last max this week\./);
 assert.match(a.run(`S.today.sid='A';viewTrain(phase())`),/Not today: a max was tested in the last week\./);
 assert.match(a.run('coachSummary()'),/2026-09-25 B \(max test: hspu\) \[Clean\]/);
 a.run('openHist=0');assert.match(a.run('viewHistory()'),/Max test: HSPU/);
 a.time('2026-10-02T12:00:00');a.run(`refreshCalendarDay();S.today.sid='A'`);html=a.run('viewTrain(phase())');
 assert.match(html,/Due: Tuck front lever, no max recorded yet/);assert.equal((html.match(/logSet\('a8',/g)||[]).length,3);
 a.run('setMaxTest(false)');html=a.run('viewTrain(phase())');assert.match(html,/Skipped for this workout\./);assert.equal((html.match(/logSet\('a8',/g)||[]).length,5);assert.ok(!html.includes('Max tuck front lever'));
 a.run('setMaxTest(true)');assert.equal(a.run('S.today.maxTest'),'lever');
 a.run('clearDay()');assert.equal(a.run('S.today.maxTest'),undefined,'clear returns to automatic');
 a.run(`pickSession('C');confirmSessionChange()`);assert.equal(a.run('S.today.maxTest'),undefined);
 html=a.run('viewTrain(phase())');assert.match(html,/Due: Tuck front lever/);assert.match(html,/onclick="setMaxTest\('pullup'\)"/,'C offers a choice');
 a.run(`setMaxTest('pullup')`);html=a.run('viewTrain(phase())');assert.match(html,/Pull ups, no max recorded yet/);
 assert.equal((html.match(/logSet\('c3',/g)||[]).length,2);assert.equal((html.match(/logSet\('c8',/g)||[]).length,4,'lever back to full');
 a.run(`setMaxTest('nope')`);assert.equal(a.run('S.today.maxTest'),'pullup');
 const before=a.json('S');a.fail(true);a.run('setMaxTest(false)');assert.deepEqual(a.json('S'),before);
});
test('max tests wait six weeks per lift, step aside for light sessions and wrist breaks, and keep a pending change',()=>{
 const a=boot();a.run(`S.prs.hspu=[{date:'2026-08-10',value:3}];S.prs.lever=[{date:'2026-09-10',value:8}];S.today.sid='B'`);
 assert.match(a.run('viewTrain(phase())'),/Due: HSPU, last max 6 weeks ago/);
 a.run(`S.prs.hspu=[{date:'2026-09-01',value:3}]`);assert.match(a.run('viewTrain(phase())'),/Nothing due\. HSPU: last max 3 weeks ago\./);
 a.run(`S.prs.hspu=[{date:'2026-08-13',value:3}];setTargetMode('reduced')`);assert.match(a.run('viewTrain(phase())'),/Not on a light session/);
 a.run(`setTargetMode('normal');setWristBreak(true)`);assert.match(a.run('viewTrain(phase())'),/Not on a wrist break/);
 a.run(`setWristBreak(false)`);assert.match(a.run('viewTrain(phase())'),/Due: HSPU/);
 a.run(`S.progress.pending.B={id:'b3',date:'2026-09-20'};[0,1,2].forEach(i=>logSet('b3',i,1));finish()`);
 assert.equal(a.run('S.progress.pending.B.id'),'b3','a light max day does not train the change');
 const saved=a.json('S');delete saved.maxKeysVersion;for(const p of saved.plan)for(const e of p.ex)delete e.max;saved.plan[2].ex.find(e=>e.id==='c3').n='Weighted pull ups';
 const b=boot(saved);assert.equal(b.run(`S.plan[1].ex.find(e=>e.id==='b3').max`),'hspu');assert.equal(b.run(`S.plan[2].ex.find(e=>e.id==='c3').max`),undefined,'renamed exercise untouched');
 assert.equal(b.run(`S.plan[2].ex.find(e=>e.id==='c8').max`),'lever');assert.equal(b.run('S.maxKeysVersion'),1);
 assert.equal(boot().run(`S.today.sid='T';maxControl(sess())`),'','no switch on the benchmark session');
});
test('a wrist break that drops most of a workout offers the longest-waiting hanging workout instead',()=>{
 const a=boot(null,'2026-10-06T08:00:00');
 a.run(`S.history=[{date:'2026-09-30',sid:'A',detail:[]},{date:'2026-10-02',sid:'C',detail:[]},{date:'2026-10-04',sid:'B',detail:[]}];syncNext()`);
 assert.equal(a.run('S.today.sid'),'D');assert.equal(a.run('viewWristSwap(sess())'),'','nothing without the break');
 a.run('setWristBreak(true)');let html=a.run('viewTrain(phase())');
 assert.match(html,/Wrist break drops 4 of 6 exercises here\.<\/b> Train A · Pull \/ front lever instead\? D comes back next time\./,'A has waited longest of the hanging workouts');
 assert.match(html,/onclick="switchForWrist\('A'\)">Train A today/);
 a.run(`S.today.sid='B'`);assert.equal(a.run('viewWristSwap(sess())'),'','B keeps most of its work (2 of 5 dropped)');
 a.run(`S.today.sid='C'`);assert.equal(a.run('viewWristSwap(sess())'),'','C keeps 2 of 4');
 a.run(`S.today.sid='D';switchForWrist('C')`);assert.equal(a.run('S.today.sid'),'D','only the offered workout is accepted');
 a.run(`switchForWrist('A')`);assert.equal(a.run('S.today.sid'),'A');assert.equal(a.run('S.today.selectionConfirmed'),true);assert.equal(a.run('S.today.wristBreak'),true,'the break stays on');
 assert.equal(a.run('viewWristSwap(sess())'),'');
 a.run(`logSet('a8',0,6);setFeel('clean');finish()`);assert.equal(a.run('S.today.sid'),'D','D comes back next time');
 a.run(`setWristBreak(true);logSet('d13support',0,15)`);assert.equal(a.run('viewWristSwap(sess())'),'','no offer once sets are logged');
 a.run('clearDay()');a.run('setWristBreak(true)');const before=a.json('S');a.fail(true);a.run(`switchForWrist('A')`);assert.deepEqual(a.json('S'),before);
});
console.log(`${passed} tool groups passed.`);
