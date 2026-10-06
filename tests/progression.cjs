const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
// Log every set of the listed exercises at its shown target, rate the session and finish it.
function train(a,sid,ids,feel,feelEx,day){
 if(day)a.time(day+'T12:00:00');
 a.run(`refreshCalendarDay();S.today.sid='${sid}';S.today.selectionConfirmed=true;S.today.maxTest=false`);
 for(const id of ids)a.run(`(()=>{const e=sess().ex.find(x=>x.id==='${id}');setTargets(e,1).forEach((t,i)=>logSet('${id}',i,t))})()`);
 if(feel)a.run(`setFeel('${feel}')`);
 for(const id of feelEx||[])a.run(`toggleFeelEx('${id}')`);
 a.run('finish()');
}
const steps=(a,sid)=>a.json(`sessionProgress(S.plan.find(p=>p.id==='${sid}'))`);
const ex=(a,sid,id)=>a.json(`S.plan.find(p=>p.id==='${sid}').ex.find(e=>e.id==='${id}')`);

test('ladder rungs retrace in both directions and format compactly',()=>{
 const a=boot(),rule=a.json('LADDERS.b3');
 let t=[1,1,1,1,1];const seen=[];
 for(;;){const n=a.json(`stepTargets(${JSON.stringify(t)},LADDERS.b3,1)`);if(!n)break;seen.push(n);t=n;}
 assert.deepEqual(seen,[[2,1,1,1,1],[2,2,1,1,1],[2,2,2,1,1],[2,2,2,2,1],[2,2,2,2,2]]);
 assert.equal(rule.top,2);
 assert.deepEqual(a.json('stepTargets([2,2,1,1,1],LADDERS.b3,-1)'),[2,1,1,1,1]);
 assert.equal(a.json('stepTargets([1,1,1,1,1],LADDERS.b3,-1)'),null);
 t=[6,6,6,6,6];const lever=[];
 for(;;){const n=a.json(`stepTargets(${JSON.stringify(t)},LADDERS.a8,1)`);if(!n)break;lever.push(n);t=n;}
 assert.deepEqual(lever,[[7,7,7,6,6],[7,7,7,7,7],[8,8,8,7,7],[8,8,8,8,8]],'lever adds to some holds, then all');
 assert.deepEqual(a.json('stepTargets([7,7,7,7,7],LADDERS.a8,-1)'),[7,7,7,6,6]);
 assert.deepEqual(a.json('stepTargets([5,5,5,5],LADDERS.d12tuck,1)'),[6,6,5,5]);
 assert.deepEqual(a.json('stepTargets([15,15,15],LADDERS.d13support,1)'),[18,18,18]);
 assert.deepEqual(a.json('stepTargets([29,29,29],LADDERS.d13support,1)'),[30,30,30]);
 assert.equal(a.run(`fmtTargets([2,1,1,1,1],S.plan[1].ex.find(e=>e.id==='b3'))`),'1×2 + 4×1');
 assert.equal(a.run(`fmtTargets([7,6,6,6,6],S.plan[0].ex.find(e=>e.id==='a8'))`),'up to 1×7s + 4×6s');
 assert.equal(a.run(`fmtTargets([6,6,6,6,6],S.plan[0].ex.find(e=>e.id==='a8'))`),'5 × up to 6s');
});
test('only clean, normal-target sessions with every set met count toward a step up',()=>{
 const a=boot();
 train(a,'B',['b11push']);assert.equal(steps(a,'B').b11push.kind,'wait','unrated session');
 train(a,'B',['b11push'],'grindy');assert.equal(steps(a,'B').b11push.kind,'wait','grindy session');
 a.run(`S.today.sid='B';S.today.maxTest=false;[0,1,2].forEach(i=>logSet('b11push',i,10));nudge('b11push',-1);setFeel('clean');finish()`);
 assert.equal(steps(a,'B').b11push.kind,'wait','missed a rep');
 a.run(`setTargetMode('reduced')`);train(a,'B',['b11push'],'clean');assert.equal(steps(a,'B').b11push.kind,'wait','reduced targets');
 a.run(`setTargetMode('normal')`);train(a,'B',['b11push','b3'],'grindy',['b3']);
 const p=steps(a,'B').b11push;assert.equal(p.kind,'up','grindy named on another exercise leaves this one clean');
 assert.deepEqual(p.to,[11,10,10]);assert.equal(steps(a,'B').b3.kind,'wait');
 assert.deepEqual(a.json('S.history[0].feelEx'),['b3']);assert.equal(a.run('S.history[0].feel'),'grindy');
});
test('two-session ladders count a streak and legacy records without targets never count',()=>{
 const a=boot();a.run(`S.history=[{date:'2026-09-20',sid:'C',feel:'clean',detail:[{id:'c3',n:'Pull ups',unit:'reps',sets:[5,5,5,5]}]}]`);
 assert.equal(steps(a,'C').c3.streak,0);
 train(a,'C',['c3'],'clean');let p=steps(a,'C').c3;assert.equal(p.kind,'wait');assert.equal(p.streak,1);
 assert.match(a.run(`viewStep(S.plan[2],S.plan[2].ex.find(e=>e.id==='c3'),sessionProgress(S.plan[2]).c3,false)`),/2 clean sessions at this target · 1 so far/);
 train(a,'C',['c3'],'clean');p=steps(a,'C').c3;assert.equal(p.kind,'up');assert.deepEqual(p.to,[6,5,5,5]);
});
test('accepting a step up changes only that exercise, logs it and moves chips to per-set targets',()=>{
 const a=boot();train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false`);
 const before=a.json('S.plan');a.run(`stepAction('b3','accept')`);
 const b3=ex(a,'B','b3');assert.deepEqual(b3.perSet,[2,1,1,1,1]);assert.equal(b3.reps,2);assert.equal(b3.sets,5);
 const after=a.json('S.plan');after[1].ex.find(e=>e.id==='b3').perSet=undefined;after[1].ex.find(e=>e.id==='b3').reps=1;
 assert.deepEqual(JSON.parse(JSON.stringify(after)),before);
 assert.deepEqual(a.json('S.progress.log[0]'),{date:'2026-09-25',sid:'B',id:'b3',n:'Freestanding HSPU',kind:'up',from:'5 × 1',to:'1×2 + 4×1'});
 const html=a.run('viewTrain(phase())');assert.ok(html.includes(`logSet('b3',0,2)`));assert.ok(html.includes(`logSet('b3',1,1)`));assert.ok(html.includes('1×2 + 4×1'));
 a.run(`logSet('b3',0,2)`);assert.deepEqual(a.json('S.today.log.b3'),[2]);
 a.run(`editField('B','b3','reps','1')`);assert.equal(ex(a,'B','b3').perSet,undefined,'manual dose replaces per-set targets');
});
test('one step up per workout until that workout is trained again',()=>{
 const a=boot();train(a,'B',['b11push','b12er'],'clean');
 let p=steps(a,'B');assert.equal(p.b11push.kind,'up');assert.equal(p.b12er.kind,'queued');
 a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b12er','accept')`);assert.equal(ex(a,'B','b12er').reps,15,'queued item cannot be accepted');
 a.run(`stepAction('b11push','accept')`);p=steps(a,'B');
 assert.equal(p.b12er.kind,'queued');assert.equal(p.b12er.behind,'Push ups');assert.equal(a.run('S.progress.pending.B.id'),'b11push');
 assert.ok(a.run(`viewTrain(phase())`).includes('Step up ready after the Push ups change has been trained.'));
 train(a,'B',['b11push','b12er'],'clean','','2026-09-26');
 assert.equal(a.run('S.progress.pending.B'),undefined);p=steps(a,'B');
 assert.equal(p.b12er.kind,'up','the exercise waiting longest gets the next slot');assert.equal(p.b11push.kind,'queued');assert.equal(p.b11push.behind,'Band external rotations');
});
test('Not yet hides a suggestion until the next session of that workout',()=>{
 const a=boot();train(a,'B',['b11push','b12er'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b11push','later')`);
 let p=steps(a,'B');assert.ok(p.b11push.snoozed);assert.equal(p.b12er.kind,'up','a declined step does not block the next one');
 assert.ok(!a.run('viewTrain(phase())').includes(`stepAction('b11push','accept')`));
 train(a,'B',['b11push'],'clean');p=steps(a,'B');assert.ok(!p.b11push.snoozed);assert.equal(p.b11push.kind,'up');
});
test('ache on a named exercise offers a step back; unnamed ache offers nothing',()=>{
 const a=boot();a.run(`S.plan[3].ex.find(e=>e.id==='d12tuck').perSet=[7,7,6,6];S.plan[3].ex.find(e=>e.id==='d12tuck').reps=7`);
 train(a,'D',['d12tuck','d11finger'],'ache');let p=steps(a,'D');
 assert.equal(p.d12tuck.kind,'wait');assert.equal(p.d11finger.kind,'wait');
 train(a,'D',['d12tuck','d11finger'],'ache',['d12tuck']);p=steps(a,'D');
 assert.equal(p.d12tuck.kind,'back');assert.deepEqual(p.d12tuck.to,[6,6,6,6],'half ladder retraces 2×7s + 2×6s to 4×6s');assert.equal(p.d11finger.kind,'up');
 a.run(`S.today.sid='D';S.today.maxTest=false;stepAction('d12tuck','accept')`);assert.equal(ex(a,'D','d12tuck').perSet,undefined);assert.equal(ex(a,'D','d12tuck').reps,6);
 assert.equal(a.run('S.progress.log[0].kind'),'back');assert.equal(steps(a,'D').d12tuck.kind,'wait','no repeat once stepped back');
 train(a,'D',['d12tuck'],'ache',['d12tuck']);a.run(`S.today.sid='D';S.today.maxTest=false;stepAction('d12tuck','later')`);
 assert.match(a.run(`viewStep(sess(),sess().ex.find(e=>e.id==='d12tuck'),sessionProgress(sess()).d12tuck,false)`),/Kept this target after the ache/);
 assert.equal(ex(a,'D','d12tuck').reps,6);
});
test('milestones at the top can be acknowledged or reset to the planned restart',()=>{
 const a=boot();a.run(`S.plan[1].ex.find(e=>e.id==='b12er').reps=20;S.plan[3].ex.find(e=>e.id==='d14er').reps=20`);train(a,'B',['b12er'],'clean');
 let p=steps(a,'B').b12er;assert.equal(p.kind,'milestone');
 a.run(`S.today.sid='B';S.today.maxTest=false`);assert.ok(a.run('viewTrain(phase())').includes('Switched · reset to 2 × 15'));
 a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b12er','reset')`);assert.equal(ex(a,'B','b12er').reps,15);assert.equal(ex(a,'D','d14er').reps,15,'shared ladder resets on both workouts');assert.equal(a.run('S.progress.log[0].kind'),'reset');
 a.run(`S.plan[2].ex.find(e=>e.id==='c3').reps=6`);train(a,'C',['c3'],'clean');train(a,'C',['c3'],'clean');
 assert.equal(steps(a,'C').c3.kind,'milestone');a.run(`S.today.sid='C';S.today.maxTest=false;stepAction('c3','ack')`);
 assert.equal(steps(a,'C').c3.kind,'top');assert.equal(a.run('S.progress.log[0].kind'),'milestone');assert.equal(ex(a,'C','c3').reps,6);
});
test('custom exercises, changed units, older routines and benchmarks get no ladder',()=>{
 const a=boot();a.run(`addEx('B')`);const id=a.run(`S.plan[1].ex.at(-1).id`);
 assert.equal(a.json(`ladderFor(S.plan[1].ex.at(-1))`),null,id);
 a.run(`editField('B','b11push','unit','s')`);assert.equal(a.json(`ladderFor(S.plan[1].ex.find(e=>e.id==='b11push'))`),null);
 a.run(`editField('B','b11push','unit','reps');editField('B','b11push','n','Diamond push ups')`);assert.ok(a.json(`ladderFor(S.plan[1].ex.find(e=>e.id==='b11push'))`),'renames keep the ladder');
 a.run(`S.planVersion=3`);assert.deepEqual(steps(a,'B'),{});a.run(`S.planVersion=PLAN_VERSION`);
 a.run(`pickSession('T');confirmSessionChange()`);assert.ok(!a.run('viewTrain(phase())').includes('How did it go?'));
});
test('check-in resets with the draft and a failed save leaves everything intact',()=>{
 const a=boot();a.run(`S.today.sid='B';S.today.maxTest=false;logSet('b3',0,1);setFeel('ache');toggleFeelEx('b3')`);
 assert.equal(a.run('S.today.feel'),'ache');a.run(`setFeel('clean')`);assert.equal(a.run('S.today.feelEx'),undefined);
 a.run('clearDay()');assert.equal(a.run('S.today.feel'),undefined);
 train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false`);const before=a.json('S');a.fail(true);a.run(`stepAction('b3','accept')`);
 assert.deepEqual(a.json('S'),before);a.fail(false);
});
test('progress and per-set targets survive reload and backup; legacy saves gain empty progress',()=>{
 const a=boot();train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b3','accept')`);
 const b=boot(JSON.parse(a.store.get('barlog.v1')));assert.deepEqual(b.json('S.progress'),a.json('S.progress'));
 assert.deepEqual(ex(b,'B','b3').perSet,[2,1,1,1,1]);
 b.set('backupText',a.run('snapshot()'));b.run('wipe();applyBackup(backupText)');assert.deepEqual(ex(b,'B','b3').perSet,[2,1,1,1,1]);
 const legacy=a.json('S');delete legacy.progress;const c=boot(legacy);assert.deepEqual(c.json('S.progress'),{log:[],pending:{},snooze:{},acks:{},reducedSnooze:'',readyDate:'',readySkip:''});
 const bad=a.json('S');bad.plan[1].ex.find(e=>e.id==='b3').perSet=[2,1];assert.deepEqual(boot(bad).json(`fullTargets(S.plan[1].ex.find(e=>e.id==='b3'))`),[2,2,2,2,2]);
});
test('rated backfills count; they clear a pending change only when on or after it',()=>{
 const a=boot('', '2026-09-25T12:00:00');
 a.run(`bfSid='B';bfDate='2026-09-24';bfLog={b11push:[10,10,10]};bfSet('feel','clean');addPast()`);
 assert.equal(a.run('S.history[0].feel'),'clean');assert.deepEqual(a.json('S.history[0].detail[0].target'),[10,10,10]);
 assert.equal(steps(a,'B').b11push.kind,'up');a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b11push','accept')`);
 a.run(`bfSid='B';bfDate='2026-09-20';bfLog={b3:[1]};addPast()`);assert.equal(a.run('S.progress.pending.B.id'),'b11push');
 a.run(`bfSid='B';bfDate='2026-09-25';bfLog={b3:[1]};addPast()`);assert.equal(a.run('S.progress.pending.B'),undefined);
});
test('every view renders with suggestions, check-in and step log present',()=>{
 const a=boot();train(a,'B',['b3','b11push'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b3','accept');logSet('b3',0,2);setFeel('grindy')`);
 const html=a.run('viewTrain(phase())');assert.ok(html.includes('How did it go?'));assert.ok(html.includes(`toggleFeelEx('b3')`));
 const prog=a.run('viewProgress()');assert.ok(prog.includes('Step ups and milestones'));assert.ok(prog.includes('5 × 1 → 1×2 + 4×1'));
 assert.ok(a.run(`editSess='B';viewEdit()`).includes('Per-set targets from step ups: 1×2 + 4×1'));
 for(const t of ['train','progress','edit','data'])a.run(`go('${t}')`);
});
test('lever on A and C and external rotations on B and D share one ladder each',()=>{
 const a=boot();
 train(a,'A',['a8'],'clean');assert.equal(steps(a,'A').a8.streak,1);assert.equal(steps(a,'C').c8.streak,1,'an A session counts for C');
 assert.deepEqual(steps(a,'C').c8.shared,['A']);
 assert.match(a.run(`S.today.sid='C';S.today.maxTest=false;viewTrain(phase())`),/at this target across C and A · 1 so far/);
 train(a,'C',['c8'],'clean');
 let p=steps(a,'A').a8;assert.equal(p.kind,'up');assert.deepEqual(p.to,[7,7,7,6,6]);
 assert.deepEqual(p.moves.map(m=>[m.sid,m.e.id,m.to]),[['A','a8',[7,7,7,6,6]],['C','c8',[7,7,6,6]]]);
 assert.match(a.run(`S.today.sid='A';S.today.maxTest=false;viewTrain(phase())`),/2 clean sessions across A and C at 5 × 6s\. Next: 3×7s \+ 2×6s\. Also changes C\./);
 a.run(`stepAction('a8','accept')`);
 assert.deepEqual(ex(a,'A','a8').perSet,[7,7,7,6,6]);assert.deepEqual(ex(a,'C','c8').perSet,[7,7,6,6]);
 assert.deepEqual(a.json('S.progress.log.map(x=>x.sid+x.id)'),['Cc8','Aa8']);
 assert.equal(a.run('S.progress.pending.A.id'),'a8');assert.equal(a.run('S.progress.pending.C.id'),'c8');
 train(a,'C',['c8'],'clean');p=steps(a,'A').a8;assert.equal(p.kind,'wait');assert.equal(p.streak,1,'new targets count on either workout');
 train(a,'A',['a8'],'clean');assert.equal(steps(a,'C').c8.kind,'up');
});
test('a shared step waits for pending changes in either workout, and Not yet covers both',()=>{
 const a=boot();a.run(`S.plan[2].ex.find(e=>e.id==='c3').reps=5`);
 train(a,'C',['c8','c3'],'clean');train(a,'C',['c8','c3'],'clean');
 a.run(`S.today.sid='C';S.today.maxTest=false`);let p=steps(a,'C');assert.equal(p.c8.kind,'up');assert.equal(p.c3.kind,'queued');
 a.run(`stepAction('c8','later')`);p=steps(a,'C');assert.equal(p.c3.kind,'up');assert.ok(steps(a,'A').a8.snoozed,'snooze is shared');
 a.run(`stepAction('c3','accept')`);
 const q=steps(a,'C').c8;assert.ok(q.snoozed);
 train(a,'A',['a8'],'clean');const r=steps(a,'A').a8;assert.equal(r.kind,'queued','C still has an untrained pull up change');assert.equal(r.behind,'Pull ups');
 train(a,'C',['c8','c3'],'clean');assert.equal(steps(a,'A').a8.kind,'up');
});
test('ache on external rotations in D offers the shared step back from B',()=>{
 const a=boot();a.run(`S.plan[1].ex.find(e=>e.id==='b12er').perSet=[16,15];S.plan[1].ex.find(e=>e.id==='b12er').reps=16;S.plan[3].ex.find(e=>e.id==='d14er').perSet=[16,15];S.plan[3].ex.find(e=>e.id==='d14er').reps=16`);
 train(a,'D',['d14er'],'ache',['d14er']);a.run(`S.today.sid='B';S.today.maxTest=false`);
 const p=steps(a,'B').b12er;assert.equal(p.kind,'back');assert.equal(p.reason,'ache');
 assert.match(a.run('viewTrain(phase())'),/Step back to 2 × 15\?.*Also changes D\./s);
 a.run(`stepAction('b12er','accept')`);assert.equal(ex(a,'B','b12er').reps,15);assert.equal(ex(a,'D','d14er').reps,15);
});
test('next-day soreness is asked once, stored on the previous session and editable that day',()=>{
 const a=boot();assert.equal(a.run('viewReadiness()'),'','no history');
 train(a,'B',['b3'],'clean');assert.equal(a.run('viewReadiness()'),'','only a session from today');
 a.time('2026-09-26T08:00:00');a.run('refreshCalendarDay()');
 let html=a.run('viewReadiness()');assert.match(html,/How do you feel today\?<\/b> Logged against B on 25\/09/);assert.match(html,/Skip today/);
 a.run(`setSoreness('sore')`);assert.equal(a.run('S.history[0].soreness'),'sore');
 html=a.run('viewReadiness()');assert.match(html,/aria-pressed="true" onclick="setSoreness\('sore'\)"/);assert.ok(!html.includes('Skip today'));
 a.run(`setSoreness('very')`);assert.equal(a.run('S.history[0].soreness'),'very');
 a.run(`S.today.sid='C';S.today.maxTest=false;logSet('c3',0,5)`);assert.equal(a.run('viewReadiness()'),'','hidden once sets are logged');a.run('clearDay()');
 a.time('2026-09-27T08:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('viewReadiness()'),'','already answered for that session');
 train(a,'C',['c3'],'clean');a.time('2026-09-28T08:00:00');a.run('refreshCalendarDay()');
 assert.match(a.run('viewReadiness()'),/Logged against C on 27\/09/);a.run(`setSoreness('skip')`);assert.equal(a.run('viewReadiness()'),'');
 assert.equal(a.run('S.history[0].soreness'),undefined,'skip stores nothing');
 a.time('2026-10-02T08:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('viewReadiness()'),'','more than three days later');
 a.time('2026-09-28T09:00:00');a.run(`refreshCalendarDay();S.progress.readySkip=''`);const before=a.json('S');a.fail(true);a.run(`setSoreness('fresh')`);assert.deepEqual(a.json('S'),before);a.fail(false);
});
test('too sore breaks step-up streaks and, after a new target, offers a step back',()=>{
 const a=boot();
 train(a,'B',['b3'],'clean','','2026-09-20');a.time('2026-09-21T08:00:00');a.run(`setSoreness('very')`);
 assert.equal(steps(a,'B').b3.kind,'wait','too sore session does not count');assert.equal(steps(a,'B').b3.streak,0);
 assert.notEqual(steps(a,'B').b3.kind,'back','no new target, so nothing to step back from');
 train(a,'B',['b3'],'clean','','2026-09-22');a.time('2026-09-23T08:00:00');a.run(`setSoreness('sore')`);
 assert.equal(steps(a,'B').b3.kind,'up','a bit sore still counts');
 a.run(`S.today.sid='B';S.today.maxTest=false;stepAction('b3','accept')`);
 train(a,'B',['b3'],'clean','','2026-09-24');a.time('2026-09-25T08:00:00');a.run(`setSoreness('very')`);
 const p=steps(a,'B').b3;assert.equal(p.kind,'back');assert.equal(p.reason,'sore');assert.deepEqual(p.to,[1,1,1,1,1]);
 a.run(`S.today.sid='B';S.today.maxTest=false`);assert.match(a.run('viewTrain(phase())'),/Too sore after the first session at this step \(24\/09\)/);
 a.run(`stepAction('b3','later')`);assert.match(a.run('viewTrain(phase())'),/Kept this target after the sore day/);
});
test('soreness shows in the check-in review, history, AI summary and the Reduced suggestion',()=>{
 const a=boot();
 train(a,'B',['b3'],'clean','','2026-09-20');a.time('2026-09-21T08:00:00');a.run(`setSoreness('very')`);
 train(a,'C',['c3'],'clean','','2026-09-21');a.time('2026-09-22T08:00:00');a.run(`setSoreness('fresh')`);
 assert.equal(a.json('reducedHint()'),null);
 train(a,'D',['d11finger'],'clean','','2026-09-22');a.time('2026-09-23T08:00:00');a.run(`setSoreness('very')`);
 assert.equal(a.json('reducedHint()').count,2);
 assert.match(a.run('viewCheckins()'),/Next day: Fresh 1 · A bit sore 0 · Too sore 2/);
 assert.match(a.run('coachSummary()'),/2026-09-20 B \[Clean; next day: too sore\]/);
 a.run('openHist=2');assert.match(a.run('viewHistory()'),/Clean · next day too sore/);
});
test('When to progress shows only where no ladder applies; dips wording is repaired once',()=>{
 const a=boot();
 const train=sid=>a.run(`S.today.sid='${sid}';viewTrain(phase())`);
 const dropdowns=sid=>(train(sid).match(/<summary>When to progress<\/summary>/g)||[]).length;
 assert.equal(dropdowns('A'),3,'OAHS practice, explosive pull ups, ring rows');
 assert.equal(dropdowns('B'),1,'deficit HSPU only');assert.equal(dropdowns('C'),2,'OAHS practice, light lean');assert.equal(dropdowns('D'),1,'OAHS shifts');
 assert.ok(!/When to progress<\/summary>Ladder: 5×1/.test(train('B')));
 a.run(`editField('B','b11push','unit','s')`);assert.match(train('B'),/When to progress<\/summary>When all sets feel easy/,'ladder off, prose back');
 const saved=a.json('S');delete saved.dipsCopyVersion;saved.plan[1].ex.find(e=>e.id==='b10dips').progression='If your shoulder stays quiet for two weeks, add a rep to one set.';
 const b=boot(saved);assert.equal(b.run(`S.plan[1].ex.find(e=>e.id==='b10dips').progression`),'After two clean sessions with a quiet shoulder, add a rep to one set.');
 assert.equal(b.run('S.dipsCopyVersion'),1);
 const own=a.json('S');delete own.dipsCopyVersion;own.plan[1].ex.find(e=>e.id==='b10dips').progression='My dips rule';
 assert.equal(boot(own).run(`S.plan[1].ex.find(e=>e.id==='b10dips').progression`),'My dips rule','personal wording kept');
 const later=b.json('S');later.plan[1].ex.find(e=>e.id==='b10dips').progression=saved.plan[1].ex.find(e=>e.id==='b10dips').progression;
 assert.equal(boot(later).run(`S.plan[1].ex.find(e=>e.id==='b10dips').progression`),saved.plan[1].ex.find(e=>e.id==='b10dips').progression,'runs once only');
});
test('soreness asks about the latest session once four hours have passed, even after midnight',()=>{
 const a=boot(null,'2026-09-28T18:00:00');
 train(a,'D',['d11finger'],'clean');
 // Late session: first set and finish after midnight, so it is dated the same day as the next check.
 a.time('2026-09-30T00:20:00');a.run(`refreshCalendarDay();S.today.sid='A';S.today.maxTest=false;logSet('a8',0,6)`);
 a.time('2026-09-30T00:50:00');a.run(`setFeel('clean');finish()`);assert.equal(a.run('S.history[0].date'),'2026-09-30');
 a.time('2026-09-30T02:00:00');a.run('refreshCalendarDay()');assert.equal(a.run('viewReadiness()'),'','too soon: no question, and D is not asked about instead');
 a.time('2026-09-30T05:07:00');a.run('refreshCalendarDay()');assert.match(a.run('viewReadiness()'),/Logged against A on 30\/09/);
 a.run(`setSoreness('sore')`);assert.equal(a.run('S.history[0].soreness'),'sore');assert.equal(a.run('S.history[1].soreness'),undefined);
 // A session saved before finish times existed qualifies by date, even when dated today.
 const legacy=a.json('S');delete legacy.history[0].finishedAt;delete legacy.history[0].soreness;legacy.progress.readyDate='';
 assert.match(boot(legacy,'2026-09-30T05:07:00').run('viewReadiness()'),/Logged against A on 30\/09/);
 // A same-day backfill counts as just finished.
 const b=boot(null,'2026-09-30T20:00:00');b.run(`bfSid='C';bfDate='2026-09-30';bfLog={c3:[5,5,5,5]};addPast()`);
 assert.ok(b.run('S.history[0].finishedAt'));assert.equal(b.run('viewReadiness()'),'');
 b.run(`bfSid='C';bfDate='2026-09-29';bfLog={c3:[5,5,5,5]};addPast()`);assert.equal(b.run('S.history[0].finishedAt'),undefined,'earlier backfills carry no time');
});
test('C pull ups alternate grip, recorded per session and counted by the ladder either way',()=>{
 const a=boot();
 assert.deepEqual(a.json(`DEFAULT_PLAN[2].ex.find(e=>e.id==='c3').alt`),['Overhand','Underhand']);
 const view=()=>a.run(`S.today.sid='C';S.today.maxTest=false;viewTrain(phase())`);
 assert.match(view(),/This session: Overhand/,'fresh install starts overhand');
 train(a,'C',['c3'],'clean');assert.equal(a.run('S.history[0].detail[0].variant'),'Overhand');
 assert.match(view(),/This session: Underhand/);assert.match(view(),/Last 25\/09<\/span> 5, 5, 5, 5 <span>· overhand/);
 train(a,'C',['c3'],'clean');assert.equal(a.run('S.history[0].detail[0].variant'),'Underhand');
 assert.match(view(),/This session: Overhand/);
 assert.equal(steps(a,'C').c3.kind,'up','both grips count toward the step');
 assert.ok(!view().includes('This session: ')||!/a8[^]*This session/.test(view().split('Pull ups')[0]),'only the alternating exercise shows it');
 assert.match(a.run('coachSummary()'),/Pull ups \(underhand\): 5,5,5,5/);
 a.run('openHist=0');assert.match(a.run('viewHistory()'),/Pull ups<\/span> · 5, 5, 5, 5 · underhand/);
 assert.match(a.run(`editSess='C';viewEdit()`),/Alternates each session: Overhand \/ Underhand/);
 assert.match(a.run(`bfSid='C';viewBfExercises('C',1)`),/Records: Overhand/);
 a.run(`bfSid='C';bfDate='2026-09-24';bfLog={c3:[5,5,5,5]};addPast()`);assert.equal(a.run(`S.history.find(r=>r.manual).detail[0].variant`),'Overhand');
});
test('grip alternation is added once to saved default pull ups and treats older sessions as overhand',()=>{
 const a=boot();const saved=a.json('S');delete saved.gripAlternationVersion;delete saved.plan[2].ex.find(e=>e.id==='c3').alt;
 saved.history=[{date:'2026-09-21',sid:'C',detail:[{id:'c3',n:'Pull ups',unit:'reps',sets:[5,4,5,5]}]}];
 const b=boot(saved);assert.deepEqual(b.json(`S.plan[2].ex.find(e=>e.id==='c3').alt`),['Overhand','Underhand']);assert.equal(b.run('S.gripAlternationVersion'),1);
 assert.match(b.run(`S.today.sid='C';S.today.maxTest=false;viewTrain(phase())`),/This session: Underhand/,'an unlabelled earlier session counts as overhand');
 const own=a.json('S');delete own.gripAlternationVersion;const c3=own.plan[2].ex.find(e=>e.id==='c3');delete c3.alt;c3.n='Weighted pull ups';
 assert.equal(boot(own).run(`S.plan[2].ex.find(e=>e.id==='c3').alt`),undefined,'renamed exercise untouched');
 const later=b.json('S');delete later.plan[2].ex.find(e=>e.id==='c3').alt;
 assert.equal(boot(later).run(`S.plan[2].ex.find(e=>e.id==='c3').alt`),undefined,'a deliberate removal sticks');
 const bad=a.json('S');bad.plan[2].ex.find(e=>e.id==='c3').alt=['Only one'];assert.equal(boot(bad).run(`nextVariant('C',S.plan[2].ex.find(e=>e.id==='c3'))`),null);
});
test('the push-up milestone offers pike push ups, then elevated pike, then only Got it',()=>{
 const a=boot();const push=()=>ex(a,'B','b11push');
 a.run(`S.plan[1].ex.find(e=>e.id==='b11push').reps=15`);train(a,'B',['b11push'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false`);
 let p=steps(a,'B').b11push;assert.equal(p.kind,'milestone');assert.equal(p.swap.n,'Pike push ups');
 assert.match(a.run('viewTrain(phase())'),/Switch to Pike push ups · 3 × 8/);
 a.run(`stepAction('b11push','swap')`);
 assert.equal(push().n,'Pike push ups');assert.equal(push().reps,8);assert.match(push().note,/Hips high/);assert.equal(push().sets,3);
 assert.deepEqual(a.json('S.progress.log[0]'),{date:'2026-09-25',sid:'B',id:'b11push',n:'Push ups → Pike push ups',kind:'swap',from:'3 × 15',to:'3 × 8'});
 assert.equal(a.run('S.progress.pending.B.id'),'b11push');assert.equal(steps(a,'B').b11push.kind,'wait','the climb restarts');
 assert.match(a.run('viewProgress()'),/Push ups → Pike push ups<\/span> · Switched · 3 × 15 → 3 × 8/);
 assert.match(a.run('coachSummary()'),/- Pike push ups: 3 × 8, rest 90s, ladder top 15/);
 a.run(`S.plan[1].ex.find(e=>e.id==='b11push').reps=15`);train(a,'B',['b11push'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false`);
 p=steps(a,'B').b11push;assert.equal(p.swap.n,'Elevated pike push ups');a.run(`stepAction('b11push','swap')`);assert.equal(push().n,'Elevated pike push ups');
 a.run(`S.plan[1].ex.find(e=>e.id==='b11push').reps=15`);train(a,'B',['b11push'],'clean');a.run(`S.today.sid='B';S.today.maxTest=false`);
 p=steps(a,'B').b11push;assert.equal(p.kind,'milestone');assert.equal(p.swap,undefined,'end of the chain');
 const html=a.run('viewTrain(phase())');assert.ok(!html.includes("'swap'"));assert.match(html,/Got it/);
 a.run(`stepAction('b11push','swap')`);assert.equal(push().n,'Elevated pike push ups','nothing to swap to');
 const b=boot();b.run(`const e=S.plan[1].ex.find(x=>x.id==='b11push');e.n='Diamond push ups';e.reps=15`);train(b,'B',['b11push'],'clean');b.run(`S.today.sid='B';S.today.maxTest=false`);
 assert.equal(steps(b,'B').b11push.swap,undefined,'a renamed exercise is not in the chain');
 const before=b.json('S');b.fail(true);b.run(`stepAction('b11push','ack')`);assert.deepEqual(b.json('S'),before);
});
console.log(`${passed} progression groups passed.`);
