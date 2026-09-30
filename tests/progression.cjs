const assert=require('node:assert/strict'),{boot}=require('./helpers/app.cjs');
let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name)}
// Log every set of the listed exercises at its shown target, rate the session and finish it.
function train(a,sid,ids,feel,feelEx,day){
 if(day)a.time(day+'T12:00:00');
 a.run(`refreshCalendarDay();S.today.sid='${sid}';S.today.selectionConfirmed=true`);
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
 a.run(`S.today.sid='B';[0,1,2].forEach(i=>logSet('b11push',i,10));nudge('b11push',-1);setFeel('clean');finish()`);
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
 const a=boot();train(a,'B',['b3'],'clean');a.run(`S.today.sid='B'`);
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
 a.run(`S.today.sid='B';stepAction('b12er','accept')`);assert.equal(ex(a,'B','b12er').reps,15,'queued item cannot be accepted');
 a.run(`stepAction('b11push','accept')`);p=steps(a,'B');
 assert.equal(p.b12er.kind,'queued');assert.equal(p.b12er.behind,'Push ups');assert.equal(a.run('S.progress.pending.B.id'),'b11push');
 assert.ok(a.run(`viewTrain(phase())`).includes('Step up ready after the Push ups change has been trained.'));
 train(a,'B',['b11push','b12er'],'clean','','2026-09-26');
 assert.equal(a.run('S.progress.pending.B'),undefined);p=steps(a,'B');
 assert.equal(p.b12er.kind,'up','the exercise waiting longest gets the next slot');assert.equal(p.b11push.kind,'queued');assert.equal(p.b11push.behind,'Band external rotations');
});
test('Not yet hides a suggestion until the next session of that workout',()=>{
 const a=boot();train(a,'B',['b11push','b12er'],'clean');a.run(`S.today.sid='B';stepAction('b11push','later')`);
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
 a.run(`S.today.sid='D';stepAction('d12tuck','accept')`);assert.equal(ex(a,'D','d12tuck').perSet,undefined);assert.equal(ex(a,'D','d12tuck').reps,6);
 assert.equal(a.run('S.progress.log[0].kind'),'back');assert.equal(steps(a,'D').d12tuck.kind,'wait','no repeat once stepped back');
 train(a,'D',['d12tuck'],'ache',['d12tuck']);a.run(`S.today.sid='D';stepAction('d12tuck','later')`);
 assert.match(a.run(`viewStep(sess(),sess().ex.find(e=>e.id==='d12tuck'),sessionProgress(sess()).d12tuck,false)`),/Kept this target after the ache/);
 assert.equal(ex(a,'D','d12tuck').reps,6);
});
test('milestones at the top can be acknowledged or reset to the planned restart',()=>{
 const a=boot();a.run(`S.plan[1].ex.find(e=>e.id==='b12er').reps=20`);train(a,'B',['b12er'],'clean');
 let p=steps(a,'B').b12er;assert.equal(p.kind,'milestone');
 a.run(`S.today.sid='B'`);assert.ok(a.run('viewTrain(phase())').includes('Switched · reset to 2 × 15'));
 a.run(`S.today.sid='B';stepAction('b12er','reset')`);assert.equal(ex(a,'B','b12er').reps,15);assert.equal(a.run('S.progress.log[0].kind'),'reset');
 a.run(`S.plan[2].ex.find(e=>e.id==='c3').reps=6`);train(a,'C',['c3'],'clean');train(a,'C',['c3'],'clean');
 assert.equal(steps(a,'C').c3.kind,'milestone');a.run(`S.today.sid='C';stepAction('c3','ack')`);
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
 const a=boot();a.run(`S.today.sid='B';logSet('b3',0,1);setFeel('ache');toggleFeelEx('b3')`);
 assert.equal(a.run('S.today.feel'),'ache');a.run(`setFeel('clean')`);assert.equal(a.run('S.today.feelEx'),undefined);
 a.run('clearDay()');assert.equal(a.run('S.today.feel'),undefined);
 train(a,'B',['b3'],'clean');a.run(`S.today.sid='B'`);const before=a.json('S');a.fail(true);a.run(`stepAction('b3','accept')`);
 assert.deepEqual(a.json('S'),before);a.fail(false);
});
test('progress and per-set targets survive reload and backup; legacy saves gain empty progress',()=>{
 const a=boot();train(a,'B',['b3'],'clean');a.run(`S.today.sid='B';stepAction('b3','accept')`);
 const b=boot(JSON.parse(a.store.get('barlog.v1')));assert.deepEqual(b.json('S.progress'),a.json('S.progress'));
 assert.deepEqual(ex(b,'B','b3').perSet,[2,1,1,1,1]);
 b.set('backupText',a.run('snapshot()'));b.run('wipe();applyBackup(backupText)');assert.deepEqual(ex(b,'B','b3').perSet,[2,1,1,1,1]);
 const legacy=a.json('S');delete legacy.progress;const c=boot(legacy);assert.deepEqual(c.json('S.progress'),{log:[],pending:{},snooze:{},acks:{},reducedSnooze:''});
 const bad=a.json('S');bad.plan[1].ex.find(e=>e.id==='b3').perSet=[2,1];assert.deepEqual(boot(bad).json(`fullTargets(S.plan[1].ex.find(e=>e.id==='b3'))`),[2,2,2,2,2]);
});
test('rated backfills count; they clear a pending change only when on or after it',()=>{
 const a=boot('', '2026-09-25T12:00:00');
 a.run(`bfSid='B';bfDate='2026-09-24';bfLog={b11push:[10,10,10]};bfSet('feel','clean');addPast()`);
 assert.equal(a.run('S.history[0].feel'),'clean');assert.deepEqual(a.json('S.history[0].detail[0].target'),[10,10,10]);
 assert.equal(steps(a,'B').b11push.kind,'up');a.run(`S.today.sid='B';stepAction('b11push','accept')`);
 a.run(`bfSid='B';bfDate='2026-09-20';bfLog={b3:[1]};addPast()`);assert.equal(a.run('S.progress.pending.B.id'),'b11push');
 a.run(`bfSid='B';bfDate='2026-09-25';bfLog={b3:[1]};addPast()`);assert.equal(a.run('S.progress.pending.B'),undefined);
});
test('every view renders with suggestions, check-in and step log present',()=>{
 const a=boot();train(a,'B',['b3','b11push'],'clean');a.run(`S.today.sid='B';stepAction('b3','accept');logSet('b3',0,2);setFeel('grindy')`);
 const html=a.run('viewTrain(phase())');assert.ok(html.includes('How did it go?'));assert.ok(html.includes(`toggleFeelEx('b3')`));
 const prog=a.run('viewProgress()');assert.ok(prog.includes('Step ups and milestones'));assert.ok(prog.includes('5 × 1 → 1×2 + 4×1'));
 assert.ok(a.run(`editSess='B';viewEdit()`).includes('Per-set targets from step ups: 1×2 + 4×1'));
 for(const t of ['train','progress','edit','data'])a.run(`go('${t}')`);
});
console.log(`${passed} progression groups passed.`);
