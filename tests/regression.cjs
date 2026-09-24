const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2]||`${__dirname}/../index.html`,'utf8').split('<script>')[1].split('</script>')[0];
const storageKey=source.includes('const KEY="barlog.v1";')?"barlog.v1":"barlog.preview.v4";
const elements=new Map(); const data=new Map(); let failSave=false;
const context=vm.createContext({console:{...console,error(){}},Date,JSON,Math,Set,Map,Number,String,Object,Array,parseInt,isNaN,
 location:{hostname:'localhost',protocol:'http:'},navigator:{},window:{},
 localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(failSave)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)},
 document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',style:{},classList:{add(){},remove(){}}});return elements.get(id)},createElement:()=>({style:{},remove(){}}),body:{appendChild(){}}},
 setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},confirm:()=>false,alert:()=>{}});
vm.runInContext(source,context);
const run=s=>vm.runInContext(s,context), json=s=>JSON.parse(run(`JSON.stringify(${s})`));
let passed=0; function test(name,f){f();passed++;console.log(`PASS ${name}`)}
test('new install and every session render across all eight weeks',()=>{assert.equal(run('KEY'),storageKey);for(let w=1;w<=8;w++){run(`S.week=${w}`);for(const sid of ['A','B','C','D','T']){run(`S.today.sid='${sid}';render();viewEdit();viewProgress();viewData()`);assert.ok(elements.get('app').innerHTML.includes('Bar'));}}});
test('fixed doses, safe week-four reduction and exercise-specific progression',()=>{for(let w=1;w<=8;w++){assert.equal(run(`repsFor(DEFAULT_PLAN[0].ex.find(e=>e.id==='a8'),${w})`),6);assert.equal(run(`repsFor(DEFAULT_PLAN[1].ex[1],${w})`),1);assert.equal(run(`setsFor(DEFAULT_PLAN[0].ex.find(e=>e.id==='a3'),${w})`),w===4?3:5);}assert.equal(run(`repsFor(DEFAULT_PLAN[3].ex.find(e=>e.id==='d8shifts'),4)`),3);assert.ok(!run('viewTrain(phase(6))').includes('Slow the eccentric'));assert.equal(run('DEFAULT_PLAN[1].ex[2].id'),'b4free');assert.ok(run('DEFAULT_PLAN[1].ex[2].optional'));});
test('legacy/custom plan load is not rewritten; adoption, undo and backup preserve records and unfinished work',()=>{run(`S=blank();S.planVersion=1;S.plan[0].ex[0].n='Custom warm up';S.plan[0].ex.push({id:'a4',n:'Custom MU',tier:'skill',sets:7,reps:2,unit:'reps',rest:60});S.today={date:'2026-01-01',sid:'A',log:{a4:[2]},band:{a4:'red'},rice:true};S.history=[{date:'2026-01-01',sid:'A',week:2,note:'kept',detail:[{n:'Original',unit:'reps',sets:[2],band:'red'}]}];S.prs.hspu=[{date:'2026-01-01',value:2}];save()`);const original=json('S');run('load()');assert.deepEqual(json('S.plan'),original.plan);assert.equal(run('S.planVersion'),1);run('switchPlan()');assert.equal(run('S.planVersion'),4);assert.deepEqual(json('S.history'),original.history);assert.deepEqual(json('S.prs'),original.prs);assert.deepEqual(json('S.planArchives[0].today'),original.today);run('restorePlan(0)');assert.deepEqual(json('S.plan'),original.plan);assert.deepEqual(json('S.today'),original.today);assert.deepEqual(JSON.parse(run('snapshot()')).history,original.history);});
test('adoption storage failure leaves original state intact',()=>{const before=json('S');failSave=true;run('switchPlan()');failSave=false;assert.deepEqual(json('S'),before)});
test('logging optional skip, one-second adjustment, history retention beyond 300 and rotation',()=>{run(`S=blank();S.today.sid='B';S.history=Array.from({length:320},(_,i)=>({date:'2025-01-01',sid:'A',note:String(i)}));logSet('b3',0,1);finish()`);assert.equal(run('S.history.length'),321);assert.equal(run('S.history[0].reps'),1);assert.equal(run('S.history[0].detail.length'),1);assert.equal(run('S.rot'),1);run(`S.today.sid='A';logSet('a8',0,6);nudge('a8',-1)`);assert.deepEqual(json('S.today.log.a8'),[5]);});
test('recent rows sort chronologically, keep same-day order and never mutate stored ordering',()=>{run(`S.history=[{date:'2026-08-01',sid:'B',note:'old'},{date:'2026-09-10',sid:'A',note:'same1'},{date:'2026-09-10',sid:'C',note:'same2'},...Array.from({length:24},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),sid:i%2?'A':'D',note:'r'+i}))];historyMode='recent'`);const before=json('S.history');assert.equal(run('historyWindow().rows.length'),5);assert.deepEqual(json('historyRows().filter(x=>x.record.date===\'2026-09-10\').map(x=>x.record.note)'),['same1','same2','r9']);run('viewHistory()');assert.deepEqual(json('S.history'),before);});
test('filtered pagination targets actual source record for date edit and delete',()=>{run(`historyMode='browse';historySession='A';historyMonth='2026-09';historyPage=1`);const rows=json('historyWindow().rows');assert.ok(rows.length);const i=rows[0].index;const before=json('S.history');run(`setHistDate(${i},'2026-07-04')`);assert.equal(run(`S.history[${i}].date`),'2026-07-04');assert.equal(run(`S.history[${i}].note`),before[i].note);assert.equal(run('historyWindow().total'),12);context.confirm=()=>true;const idx=run('historyWindow().rows[0].index');const deleted=run(`S.history[${idx}].note`);run(`delHist(${idx})`);assert.ok(!json('S.history').some(r=>r.note===deleted));context.confirm=()=>false;});
test('page clamps after deletion; empty filters and return to recent remain coherent',()=>{run(`S.history=[{date:'2026-09-01',sid:'A'}];historyPage=99;historyMonth='2026-09';historySession='A'`);assert.equal(run('historyWindow().pages'),1);assert.equal(run('historyPage'),0);run(`historySession='Z'`);assert.ok(run('viewHistory()').includes('No workouts match'));run('browseHistory(false)');assert.equal(run('historyWindow().rows.length'),1);});
test('backfill details, notes and saved plan archive survive export/import',()=>{run(`S=blank();bfSid='A';bfDate='2026-09-01';bfNote='Test note';bfAdv=false;bfRice=true;bfLog={a8:[5,6],a6:[8]};addPast();switchPlan()`);const backup=run('snapshot()');const expected=JSON.parse(backup);context.confirm=()=>true;context.backupText=backup;run('S=blank();applyBackup(backupText)');context.confirm=()=>false;assert.deepEqual(json('S.history'),expected.history);assert.deepEqual(json('S.planArchives'),expected.planArchives);assert.equal(run('S.history[0].secs'),11);assert.equal(run('S.history[0].note'),'Test note');});
test('training and backfill corrections use one unit, affect only the last logged set and clamp at zero',()=>{
  for(const [id,value] of [['a8',6],['a6',8],['a1',5]]){
    run(`S=blank(); S.today.sid='A'; S.today.log['${id}']=[${value},null,${value}]; bfSid='A'; bfLog={'${id}':[${value},null,${value}]}`);
    run(`nudge('${id}',1);bfNudge('${id}',1)`);
    assert.deepEqual(json(`S.today.log['${id}']`),[value,null,value+1]);
    assert.deepEqual(json(`bfLog['${id}']`),[value,null,value+1]);
    run(`nudge('${id}',-1);bfNudge('${id}',-1)`);
    assert.deepEqual(json(`S.today.log['${id}']`),[value,null,value]);
    assert.deepEqual(json(`bfLog['${id}']`),[value,null,value]);
    run(`S.today.log['${id}']=[0];bfLog['${id}']=[0];nudge('${id}',-1);bfNudge('${id}',-1)`);
    assert.deepEqual(json(`S.today.log['${id}']`),[0]);assert.deepEqual(json(`bfLog['${id}']`),[0]);
  }
  run(`S.today.log={a8:[6],a6:[8]};bfLog={a8:[6],a6:[8]}`);
  assert.ok(run('viewTrain(phase(1))').includes('title="Adjust last logged set by one unit"'));
  assert.ok(run('viewBfExercises("A",1)').includes('title="Adjust last logged set by one unit"'));
  assert.ok(run('viewTrain(phase(1))').includes('>+</button>'));
});
test('rice restoration upgrades adopted v4 once without changing unrelated data or custom work',()=>{
 run(`S=blank();delete S.riceRestoreVersion;S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b7');S.plan[3].ex=S.plan[3].ex.filter(e=>e.id!=='d7');S.plan[1].ex[1].reps=3;S.week=6;S.rot=9;S.today={date:'2026-09-01',sid:'B',log:{b3:[2]},band:{custom:'red'},rice:true};S.history=[{date:'2026-08-01',sid:'D',rice:true,note:'retained'}];S.prs.hspu=[{date:'2026-08-01',value:2}];save()`);
 const before=json('S');run('load()');
 assert.equal(run('S.plan[1].ex.at(-1).id'),'b7');assert.equal(run('S.plan[3].ex.at(-1).id'),'d7');
 assert.equal(run('S.plan[1].ex.at(-1).reps'),5);assert.equal(run('S.plan[1].ex[1].reps'),3);
 for(const key of ['today','history','prs','week','rot','planVersion'])assert.deepEqual(json('S.'+key),before[key]);
 const restored=json('S');run('load()');assert.deepEqual(json('S'),restored);
 run(`S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b7');save();load()`);
 assert.ok(!run(`S.plan[1].ex.some(e=>e.id==='b7')`),'later deliberate deletion stays deleted');
});
test('manual rice entries and archived plans restore without duplicate exercises or ID collisions',()=>{
 run(`S=blank();delete S.riceRestoreVersion;S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b7');S.plan[1].ex.unshift({id:'myrice',n:'Rice bucket work',sets:2,reps:7,unit:'min',tier:'prep',rest:30});S.plan[3].ex.find(e=>e.id==='d7').n='My wrist work';save()`);
 const plan=json('S.plan');run('load()');assert.deepEqual(json('S.plan'),plan);
 run(`S=blank();delete S.riceRestoreVersion;S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b7');S.plan[3].ex=S.plan[3].ex.filter(e=>e.id!=='d7');S.plan[0].ex.push({id:'b7',n:'Other custom work',sets:1,reps:1,unit:'reps',tier:'main',rest:0});S.planArchives=[archivePlan()];restorePlan(0)`);
 assert.equal(run(`S.plan[1].ex.at(-1).id`),'b7rice1');assert.equal(run(`S.plan[3].ex.at(-1).id`),'d7');
 const archive=json('S.planArchives[0]');assert.ok(!archive.plan[1].ex.some(e=>e.n==='Rice bag wrists'));
 assert.equal(run('new Set(S.plan.flatMap(p=>p.ex.map(e=>e.id))).size'),run('S.plan.flatMap(p=>p.ex).length'));
});
test('old v4 backup receives rice patch; daily rice tick and exercise details survive new session history',()=>{
 run(`S=blank();delete S.riceRestoreVersion;S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b7');S.plan[3].ex=S.plan[3].ex.filter(e=>e.id!=='d7')`);
 context.backupText=run('snapshot()');context.confirm=()=>true;run('applyBackup(backupText)');context.confirm=()=>false;
 assert.equal(run(`S.plan[1].ex.filter(e=>e.id==='b7').length`),1);
 run(`S.today.sid='B';S.today.rice=true;S.today.log={b7:[5],b3:[1]};finish()`);
 assert.equal(run('S.history[0].rice'),true);assert.deepEqual(json(`S.history[0].detail.find(e=>e.n==='Rice bag wrists').sets`),[5]);
 assert.ok(run('viewTrain(phase(1))').includes('class="daily on"'));
});
test('A/C handstand blocks have short supported practice and stable doses; other work is unchanged',()=>{
 run('S=blank()');
 for(const sid of ['A','C']){
   const rows=json(`S.plan.find(p=>p.id==='${sid}').ex`);
   assert.equal(rows[1].id,sid.toLowerCase()+'9balance');assert.equal(rows[1].reps,3);assert.equal(rows[1].budget,true);
   assert.ok(rows[1].note.includes('shift to fingertips'));assert.equal(rows[1].n,'OAHS shift practice');assert.equal(rows[2].id,sid.toLowerCase()+'8');
 }
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').sets`),5);
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').reps`),1);
 assert.ok(run(`S.plan[1].ex.find(e=>e.id==='b3').progression.includes('try a double in one set')`));
 assert.ok(run(`S.plan[1].ex.some(e=>e.id==='b7')&&S.plan[3].ex.some(e=>e.id==='d7')`));
});
test('existing v4 receives handstand patch once with preserved logs, dates, rotation, rice and custom notes',()=>{
 run(`S=blank();delete S.handstandPracticeVersion;S.plan[0].ex=S.plan[0].ex.filter(e=>e.id!=='a9balance');S.plan[2].ex=S.plan[2].ex.filter(e=>e.id!=='c9balance');S.plan[0].note='My custom note';S.plan[1].ex.find(e=>e.id==='b3').progression='My progression';S.week=6;S.rot=11;S.today={date:'2026-09-21',sid:'A',log:{a8:[5]},band:{},rice:true};S.history=[{date:'2026-09-01',sid:'A',rice:true,note:'saved'}];save()`);
 const before=json('S');run('load()');
 for(const key of ['today','history','prs','week','rot','riceRestoreVersion'])assert.deepEqual(json('S.'+key),before[key]);
 assert.equal(run('S.plan[0].note'),'My custom note');assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').progression`),'My progression');
 assert.equal(run(`S.plan[0].ex.filter(e=>e.id==='a9balance').length`),1);
 run(`S.plan[0].ex=S.plan[0].ex.filter(e=>e.id!=='a9balance');save();load()`);
 assert.ok(!run(`S.plan[0].ex.some(e=>e.id==='a9balance')`),'intentional later removal retained');
});
test('manual handstands, unknown custom sequences, archived plans and old backups are handled conservatively',()=>{
 run(`S=blank();delete S.handstandPracticeVersion;S.plan[0].ex=S.plan[0].ex.filter(e=>e.id!=='a9balance');S.plan[0].ex.push({id:'manualbalance',n:'Handstand practice',tier:'skill',sets:1,reps:4,unit:'min',rest:0});S.plan[2].ex=[{id:'custom',n:'My pull workout',tier:'main',sets:2,reps:5,unit:'reps',rest:0}];save()`);
 const before=json('S.plan');run('load()');assert.deepEqual(json('S.plan[0].ex'),before[0].ex);assert.deepEqual(json('S.plan[2].ex'),before[2].ex);
 run(`S=blank();delete S.handstandPracticeVersion;S.plan[0].ex=S.plan[0].ex.filter(e=>e.id!=='a9balance');S.plan[2].ex=S.plan[2].ex.filter(e=>e.id!=='c9balance');S.planArchives=[archivePlan()];restorePlan(0)`);
 assert.equal(run(`S.plan[0].ex.filter(e=>e.id==='a9balance').length`),1);
 assert.ok(!run(`S.planArchives[0].plan[0].ex.some(e=>e.id==='a9balance')`));
 run(`delete S.handstandPracticeVersion;S.plan[2].ex=S.plan[2].ex.filter(e=>e.id!=='c9balance');S.reducedWeek4=false`);
 context.backupText=run('snapshot()');context.confirm=()=>true;run('applyBackup(backupText)');context.confirm=()=>false;
 assert.equal(run('S.reducedWeek4'),false);assert.equal(run(`S.plan[2].ex.filter(e=>e.id==='c9balance').length`),1);
});
test('week4 normal/reduced choice preserves and displays all logs, survives backup/restore, and affects no other weeks',()=>{
 run(`S=blank();S.week=4;S.today.sid='A';S.today.log={a8:[6,5,6,5,4],a9balance:[3]};bfSid='A';bfLog={a8:[6,6,5,4,3],a9balance:[3]}`);
 const today=json('S.today'),history=json('S.history'),backfill=json('bfLog');
 assert.equal(run(`setsFor(S.plan[0].ex.find(e=>e.id==='a8'),4)`),3);
 assert.equal(run(`repsFor(S.plan[0].ex.find(e=>e.id==='a9balance'),4)`),2);
 assert.ok(run('viewTrain(phase(4))').includes("logSet('a8',4,6)"));
 assert.ok(run('viewBfExercises("A",4)').includes("bfLogSet('a8',4,6)"));
 run('setWeek4Reduced(false)');assert.equal(run(`setsFor(S.plan[0].ex.find(e=>e.id==='a8'),4)`),5);
 assert.equal(run(`repsFor(S.plan[0].ex.find(e=>e.id==='a9balance'),4)`),3);
 assert.deepEqual(json('S.today'),today);assert.deepEqual(json('bfLog'),backfill);assert.deepEqual(json('S.history'),history);
 for(const w of [1,2,3,5,6,7,8])assert.equal(run(`setsFor(S.plan[0].ex.find(e=>e.id==='a8'),${w})`),5);
 context.backupText=run('snapshot()');context.confirm=()=>true;run('S=blank();applyBackup(backupText)');context.confirm=()=>false;
 assert.equal(run('S.reducedWeek4'),false);assert.deepEqual(json('S.today'),today);
 run('setWeek4Reduced(true)');assert.deepEqual(json('S.today'),today);
});
test('corrupt stored JSON is not overwritten on boot',()=>{const local=new Map([[storageKey,'{broken']]);const other=vm.createContext({...context,localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)}});vm.runInContext(source,other);assert.equal(local.get(storageKey),'{broken');});
test('Train shows the last two results per exercise, newest first, same session only, with legacy name matching',()=>{
 run(`S=blank();S.today.sid='A';logSet('a8',0,6);logSet('a8',1,6);nudge('a8',-1);S.today.date='2026-09-10';finish()`);
 assert.deepEqual(json('S.history[0].detail.find(d=>d.n==="Tuck front lever")'),{id:'a8',n:'Tuck front lever',unit:'s',sets:[6,5]});
 run(`S.history.push({date:'2026-09-03',sid:'A',detail:[{n:'Tuck front lever',unit:'s',sets:[4,4]},{n:'Warm up',unit:'min',sets:[5]}]},
   {date:'2026-08-01',sid:'A',detail:[{n:'Tuck front lever',unit:'s',sets:[1]}]},
   {date:'2026-09-12',sid:'C',detail:[{id:'c8',n:'Tuck front lever',unit:'s',sets:[9]}]},
   {date:'2026-09-13',sid:'A',reps:20,manual:true})`);
 assert.deepEqual(json(`lastExposures('A',S.plan[0].ex.find(e=>e.id==='a8'),2).map(v=>[v.date,v.x.sets])`),[['2026-09-10',[6,5]],['2026-09-03',[4,4]]]);
 const a8=run(`viewLast('A',S.plan[0].ex.find(e=>e.id==='a8'))`);
 assert.ok(a8.includes('Last 10/09</span> 6, 5s')&&a8.includes('Before 03/09</span> 4, 4s')&&!a8.includes('9s'));
 assert.equal(run(`viewLast('A',S.plan[0].ex.find(e=>e.id==='a1'))`),'','prep work is not shown');
 run(`S.plan[0].ex.find(e=>e.id==='a8').n='Renamed lever'`);
 assert.ok(run(`viewLast('A',S.plan[0].ex.find(e=>e.id==='a8'))`).includes('Last 10/09'),'ID match survives a rename');
 run(`S.history.unshift({date:'2026-09-14',sid:'A',detail:[{id:'a8',n:'Renamed lever',unit:'s',sets:[7]}]});S.today.band={};`);
 run(`S.today.sid='A';tab='train';render()`);assert.ok(elements.get('app').innerHTML.includes('Last 14/09</span> 7s'));
});
test('hold stopwatch is gone; seconds exercises still log and correct by one',()=>{
 assert.equal(run('typeof toggleHold'),'undefined');assert.equal(run('typeof bfToggleHold'),'undefined');
 run(`S=blank();S.today.sid='A';tab='train';render()`);assert.ok(!elements.get('app').innerHTML.includes('time a hold'));
 run(`logSet('a8',0,6);nudge('a8',-1)`);assert.deepEqual(json('S.today.log.a8'),[5]);
 assert.ok(run('viewTrain(phase(1))').includes('Fix last'));
});
test('manual-max form values survive re-renders and reset after saving',()=>{
 run(`S=blank();mxLift='hspu';mxVal='4';mxDate='2026-09-01';tab='progress';render()`);
 const html=elements.get('app').innerHTML;assert.ok(html.includes('value="hspu" selected')&&html.includes('value="4"')&&html.includes('value="2026-09-01"'));
 run('addMax()');assert.deepEqual(json('S.prs.hspu.at(-1)'),{date:'2026-09-01',value:4});assert.equal(run('mxVal'),'');
});
test('saved plans get the shorter notes once; personal edits, doses and records are untouched',()=>{
 // Rebuild the previous default wording on a saved v4 plan.
 run(`S=blank();delete S.notesVersion;
  for(const s of S.plan){s.note=OLD_SESSION_NOTES[s.id][0];for(const e of s.ex){const o=OLD_EX_NOTES[e.id];if(!o)continue;e.note=o.note[0];if(o.progression)e.progression=o.progression[0];}}
  S.plan[1].ex.find(e=>e.id==='b3').note='My HSPU cue';S.plan[3].note='My D note';S.plan[2].ex.find(e=>e.id==='c3').reps=6;
  S.history=[{date:'2026-09-01',sid:'A',note:'kept'}];S.rot=7;S.week=3;save()`);
 const before=json('S');run('load()');
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').note`),'My HSPU cue');assert.equal(run('S.plan[3].note'),'My D note');
 assert.equal(run(`S.plan[2].ex.find(e=>e.id==='c3').reps`),6);
 assert.equal(run(`S.plan[0].ex.find(e=>e.id==='a8').note`),run(`DEFAULT_PLAN[0].ex.find(e=>e.id==='a8').note`));
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').progression`),run(`DEFAULT_PLAN[1].ex.find(e=>e.id==='b3').progression`));
 assert.equal(run('S.plan[0].note'),run('DEFAULT_PLAN[0].note'));
 for(const key of ['history','rot','week','today','prs'])assert.deepEqual(json('S.'+key),before[key]);
 assert.equal(run('S.notesVersion'),1);
 run(`S.plan[0].ex.find(e=>e.id==='a8').note=OLD_EX_NOTES.a8.note[0];save();load()`);
 assert.equal(run(`S.plan[0].ex.find(e=>e.id==='a8').note`),run('OLD_EX_NOTES.a8.note[0]'),'runs once only');
 // Pre-handstand plan: the inserted block and pre-handstand wording both end up short.
 run(`S=blank();delete S.notesVersion;delete S.handstandPracticeVersion;S.plan[0].ex=S.plan[0].ex.filter(e=>e.id!=='a9balance');S.plan[0].note=PULL_NOTES.A[0];S.plan[1].ex.find(e=>e.id==='b3').progression=HSPU_PROGRESS_BEFORE;save();load()`);
 assert.equal(run(`S.plan[0].ex.find(e=>e.id==='a9balance').note`),run(`DEFAULT_PLAN[0].ex.find(e=>e.id==='a9balance').note`));
 assert.equal(run('S.plan[0].note'),run('DEFAULT_PLAN[0].note'));
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').progression`),run(`DEFAULT_PLAN[1].ex.find(e=>e.id==='b3').progression`));
 // Archived plans and backups from before the change.
 run(`S=blank();S.plan[0].note=OLD_SESSION_NOTES.A[0];S.notesVersion=0;S.planArchives=[archivePlan()];delete S.planArchives[0].notesVersion;restorePlan(0)`);
 assert.equal(run('S.plan[0].note'),run('DEFAULT_PLAN[0].note'));
 run(`S=blank();S.plan[0].note=OLD_SESSION_NOTES.A[0];delete S.notesVersion`);context.backupText=run('snapshot()');context.confirm=()=>true;run('applyBackup(backupText)');context.confirm=()=>false;
 assert.equal(run('S.plan[0].note'),run('DEFAULT_PLAN[0].note'));
});
test('pressing additions: default order, week-4 reduction, and a one-time conservative update for saved plans',()=>{
 run('S=blank()');
 assert.deepEqual(json(`S.plan[1].ex.map(e=>e.id)`),['b1','b3','b4free','b10dips','b11push','b7']);
 assert.deepEqual(json(`S.plan[3].ex.map(e=>e.id)`),['d1','d8shifts','d10hspu','d9lean','d7']);
 assert.ok(run(`S.plan[1].ex.find(e=>e.id==='b10dips').optional`));assert.ok(!run(`S.plan[1].ex.find(e=>e.id==='b11push').optional`));
 for(const id of ['b10dips','b11push','d10hspu'])assert.equal(run(`setsFor(DEFAULT_PLAN.flatMap(p=>p.ex).find(e=>e.id==='${id}'),4)`),2);
 // A saved v4 plan from before the additions, with a personal edit and an unfinished log.
 const strip=`S=blank();delete S.pressWorkVersion;S.plan[3].ex.splice(4,0,{id:'d3',n:'Dips',tier:'main',sets:2,reps:5,unit:'reps',rest:120,optional:true});S.plan[1].ex=S.plan[1].ex.filter(e=>!['b10dips','b11push'].includes(e.id));S.plan[3].ex=S.plan[3].ex.filter(e=>e.id!=='d10hspu');`;
 run(strip+`S.plan[1].ex.find(e=>e.id==='b3').sets=4;S.today={date:'2026-09-24',sid:'B',log:{b3:[1,1]},band:{},rice:false};S.history=[{date:'2026-09-20',sid:'B',detail:[{n:'Dips',unit:'reps',sets:[6,6]}]}];S.rot=5;save()`);
 const before=json('S');run('load()');
 assert.deepEqual(json(`S.plan[1].ex.map(e=>e.id)`),['b1','b3','b4free','b10dips','b11push','b7']);
 assert.deepEqual(json(`S.plan[3].ex.map(e=>e.id)`),['d1','d8shifts','d10hspu','d9lean','d7']);
 assert.equal(run(`S.plan[1].ex.find(e=>e.id==='b3').sets`),4,'personal dose kept');
 for(const key of ['today','history','rot','week','prs'])assert.deepEqual(json('S.'+key),before[key]);
 assert.ok(run(`viewLast('B',S.plan[1].ex.find(e=>e.id==='b10dips'))`).includes('6, 6'),'earlier B dips show as last results');
 run(strip+`S.plan[3].ex.splice(4,0,{id:'d3',n:'Dips',tier:'main',sets:3,reps:5,unit:'reps',rest:120,optional:true});save();load()`);
 assert.ok(run(`S.plan[3].ex.some(e=>e.id==='d3')`),'personally edited D dips are kept');
 run(`S.plan[1].ex=S.plan[1].ex.filter(e=>e.id!=='b10dips');save();load()`);
 assert.ok(!run(`S.plan[1].ex.some(e=>e.id==='b10dips')`),'later deletion stays deleted');
 // Manual equivalents are not duplicated; ID collisions get a new ID; custom order falls back to the end.
 run(strip+`S.plan[1].ex.push({id:'mine',n:'Knee push-ups',tier:'accessory',sets:2,reps:12,unit:'reps',rest:60});S.plan[0].ex.push({id:'d10hspu',n:'Other',tier:'main',sets:1,reps:1,unit:'reps',rest:0});S.plan[3].ex=S.plan[3].ex.filter(e=>!['d1','d8shifts'].includes(e.id));save();load()`);
 assert.equal(run(`S.plan[1].ex.filter(e=>/push/i.test(e.n)).length`),1);assert.ok(run(`S.plan[1].ex.some(e=>e.id==='b10dips')`));
 assert.equal(run(`S.plan[3].ex.at(-1).id`),'d10hspux1');
 assert.equal(run('new Set(S.plan.flatMap(p=>p.ex.map(e=>e.id))).size'),run('S.plan.flatMap(p=>p.ex).length'));
 // Older, unadopted routines are left alone; archives and backups are updated on restore.
 run(strip+`S.planVersion=3;save();load()`);assert.ok(!run(`S.plan[1].ex.some(e=>e.id==='b11push')`));
 run(strip+`S.planArchives=[archivePlan()];restorePlan(0)`);assert.ok(run(`S.plan[3].ex.some(e=>e.id==='d10hspu')`));
 run(strip);context.backupText=run('snapshot()');context.confirm=()=>true;run('applyBackup(backupText)');context.confirm=()=>false;
 assert.ok(run(`S.plan[1].ex.some(e=>e.id==='b11push')`));
});
test('OAHS: D is the one-arm session with shifts first; saved plans rename only untouched defaults',()=>{
 run('S=blank()');assert.equal(run('S.plan[3].name'),'OAHS / planche');
 assert.equal(run('S.plan[3].ex[1].id'),'d8shifts');assert.ok(run('S.plan[3].ex[1].progression.includes("free-hand lifts")'));
 run(`S=blank();delete S.notesVersion;S.plan[3].name=OLD_SESSION_NAMES.D[0];S.plan[0].ex.find(e=>e.id==='a9balance').n=OLD_EX_NAMES.a9balance[0];
   S.plan[2].ex.find(e=>e.id==='c9balance').n='My handstand block';S.plan[3].ex.find(e=>e.id==='d8shifts').n=OLD_EX_NAMES.d8shifts[0];save();load()`);
 assert.equal(run('S.plan[3].name'),'OAHS / planche');assert.equal(run(`S.plan[0].ex.find(e=>e.id==='a9balance').n`),'OAHS shift practice');
 assert.equal(run(`S.plan[3].ex.find(e=>e.id==='d8shifts').n`),'OAHS straddle shifts');
 assert.equal(run(`S.plan[2].ex.find(e=>e.id==='c9balance').n`),'My handstand block','personal name kept');
});
console.log(`${passed} regression groups passed.`);
