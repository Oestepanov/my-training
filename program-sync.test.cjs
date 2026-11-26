const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.crypto=require('node:crypto').webcrypto;
const T=require('./android/app/src/main/assets/www/github-store.js');
const copy=x=>structuredClone(x);
const ex=id=>{const e=T.exerciseInfo(id);return {id:e.id,name:e.name};};
const workouts=[{id:'1',name:'Тренировка №1',exercises:[ex('bench-press'),ex('dumbbell-curl')]},{id:'2',name:'Тренировка №2',exercises:[ex('lat-pulldown')]},{id:'3',name:'Тренировка №3',exercises:[ex('pullover')]}];
const history={id:'old-session',workoutId:'1',date:'2026-11-20',version:1,exercises:[{exerciseId:'bench-press',name:'Жим штанги лёжа',setDetails:[{weight:47,reps:12,done:true}],completed:true,sets:1,weight:47,reps:12}]};
const pullHistory={id:'pull-session',workoutId:'3',date:'2026-11-24',version:1,exercises:[{exerciseId:'pullover',name:'Пуловер',setDetails:[{weight:8,reps:10,done:true}],completed:true,sets:1,weight:8,reps:10}]};
async function setup(seed){
 const key=T.bytesTo64(crypto.getRandomValues(new Uint8Array(32)));
 let doc=copy(seed||{schemaVersion:3,workouts,entries:[history,pullHistory]}),sha=1,writes=0,loseResponse=false;
 const remote={read:()=>copy(doc),writes:()=>writes,loseResponse:()=>loseResponse=true};
 async function client(){
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const c={online:true};
  const fetch=async(url,options)=>{
   if(!c.online)throw Error('offline');
   if(options.method==='PUT'){
    const body=JSON.parse(options.body);
    if(body.sha!==String(sha))return {ok:false,status:409};
    doc=await T.decrypt(JSON.parse(new TextDecoder().decode(T.from64(body.content))),key);sha++;writes++;
    if(loseResponse){loseResponse=false;throw Error('response lost');}
    return {ok:true,json:async()=>({})};
   }
   const envelope=await T.encrypt(doc,key);
   return {ok:true,json:async()=>({encoding:'base64',sha:String(sha),content:T.bytesTo64(new TextEncoder().encode(JSON.stringify(envelope)))})};
  };
  c.reopen=()=>c.store=new T.GitHubStore({storage,fetch,workouts,lock:f=>f()});
  c.reopen();await c.store.connect({token:'ghp_'+('x'.repeat(36)),key});return c;
 }
 return {client,remote};
}
const list=(s,id='2')=>copy(s.data().workouts.find(w=>w.id===id).exercises);
test('selecting pullover in a second workout reuses its original identity and history on both devices',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();
 const base=list(a.store),edited=[...base,ex('pullover')];
 await a.store.saveProgram('2',edited,base);await b.store.sync();
 assert.deepEqual(list(b.store),edited);assert.deepEqual(remote.read().entries,[history,pullHistory]);
 assert.equal(b.store.doc.workouts[2].exercises[0].id,b.store.doc.workouts[1].exercises[1].id);
 const old=copy(history);old.exercises[0].setDetails[0].reps=13;await b.store.mutate('save',old);
 assert.equal(remote.read().entries[0].exercises[0].name,history.exercises[0].name);
 assert.equal(remote.read().entries[0].exercises[0].reps,13);
});
test('offline catalog selections survive restart and merge with another device session',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();a.online=false;
 await a.store.saveProgram('2',[...list(a.store),ex('pullover')],list(a.store));
 await a.store.saveProgram('2',[...list(a.store),ex('pec-deck')],list(a.store));
 assert.equal(a.store.pendingCount,1);a.reopen();assert.equal(a.store.pendingCount,1);await assert.rejects(()=>a.store.disconnect());
 await b.store.mutate('save',{id:'another-session',workoutId:'2',date:'2026-11-25',exercises:[{exerciseId:'lat-pulldown',setDetails:[{weight:50,reps:12,done:true}]}]});
 a.online=true;await a.store.sync();await b.store.sync();
 assert.deepEqual(list(a.store),list(b.store));assert.equal(list(b.store)[1].id,'pullover');assert.equal(remote.read().entries.length,3);assert.equal(a.store.pendingCount,0);
});
test('different selections for the same workout require an explicit local choice',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client(),base=list(a.store);
 const left=[...base,ex('pullover')],right=[...base,ex('pec-deck')];
 await a.store.saveProgram('2',left,base);await b.store.saveProgram('2',right,base);
 assert.equal(b.store.status.kind,'conflict');assert.equal(b.store.pendingCount,1);assert.deepEqual(remote.read().workouts[1].exercises,left);
 await b.store.resolve('program-2','local');assert.deepEqual(remote.read().workouts[1].exercises,right);assert.equal(b.store.pendingCount,0);assert.deepEqual(remote.read().entries,[history,pullHistory]);
});
test('keeping the remote selection does not change sessions',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client(),base=list(a.store);
 const left=[...base,ex('pullover')],right=[...base,ex('pec-deck')];
 await a.store.saveProgram('2',left,base);await b.store.saveProgram('2',right,base);
 await b.store.resolve('program-2','remote');assert.deepEqual(list(b.store),left);assert.deepEqual(remote.read().entries,[history,pullHistory]);
});
test('selections in different workouts merge without a false conflict',async()=>{
 const {client}=await setup(),a=await client(),b=await client();
 await a.store.saveProgram('1',[...list(a.store,'1'),ex('pullover')],list(a.store,'1'));
 await b.store.saveProgram('2',[...list(b.store),ex('pec-deck')],list(b.store));
 await a.store.sync();assert.equal(a.store.conflicts.length,0);assert.equal(list(a.store,'1').length,3);assert.equal(list(a.store).length,2);
});
test('a lost success response does not duplicate the program write',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store);remote.loseResponse();
 await a.store.saveProgram('2',[...base,ex('pullover')],base);assert.equal(a.store.pendingCount,1);a.reopen();await a.store.sync();
 assert.equal(a.store.pendingCount,0);assert.equal(remote.writes(),1);assert.equal(list(a.store).length,2);
});
test('results from an exercise removed during a started workout can still be saved',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store,'1');
 await a.store.saveProgram('1',[base[1]],base);
 await a.store.mutate('save',{id:'started-earlier',workoutId:'1',date:'2026-11-25',exercises:base.map(e=>({exerciseId:e.id,setDetails:[{weight:10,reps:12,done:true}]}))});
 assert.equal(remote.read().entries.find(e=>e.id==='started-earlier').exercises.length,2);assert.deepEqual(list(a.store,'1'),[base[1]]);
});
test('new identities, renamed catalog items, duplicates and stale edits are rejected',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store);
 for(const invalid of [[],[{id:'new-exercise',name:'Пуловер'}],[{id:'pullover',name:'Другое название'}],[base[0],base[0]]])await assert.rejects(()=>a.store.saveProgram('2',invalid,base));
 assert.deepEqual(list(a.store),base);assert.equal(remote.writes(),0);
 await a.store.saveProgram('2',[ex('pullover')],base);await assert.rejects(()=>a.store.saveProgram('2',base,base));assert.deepEqual(list(a.store),[ex('pullover')]);
});
test('legacy duplicate pullovers are repaired in programs without rewriting any past results',async()=>{
 const seed={schemaVersion:3,workouts:copy(workouts),entries:[copy(history),copy(pullHistory)]};
 seed.workouts[1].exercises.push({id:'ex-old-random',name:'Пулловер'},ex('pullover'));
 seed.entries.push({...copy(pullHistory),id:'legacy-result',workoutId:'2',exercises:[{...copy(pullHistory.exercises[0]),exerciseId:'ex-old-random',name:'Пулловер',weight:9}]});
 const {client,remote}=await setup(seed),a=await client();
 assert.deepEqual(list(a.store),[ex('lat-pulldown'),ex('pullover')]);assert.deepEqual(remote.read().entries,seed.entries);assert.equal(remote.writes(),1);
 const b=await client();assert.deepEqual(list(b.store),list(a.store));assert.equal(remote.writes(),1);
 assert.equal(T.exerciseKey(seed.entries[2].exercises[0]),'pullover');
});
test('a pending edit from version 1.1 migrates to catalog identities and reconnects safely',async()=>{
 const {client,remote}=await setup(),a=await client();
 await a.store.saveProgram('2',[...list(a.store),ex('pullover')],list(a.store));
 const alias={id:'ex-old-random',name:'Пуловер'},base=[ex('lat-pulldown'),alias];
 a.store.pendingPrograms=[{workoutId:'2',baseExercises:base,exercises:[...base,ex('pec-deck')],opId:'legacy-op'}];
 a.store.doc.workouts[1].exercises=[...base,ex('pec-deck')];a.store.persist();a.reopen();
 assert.equal(a.store.pendingPrograms[0].exercises[1].id,'pullover');await a.store.sync();assert.equal(a.store.pendingCount,0);assert.equal(list(a.store)[2].id,'pec-deck');assert.deepEqual(remote.read().entries,[history,pullHistory]);
});
test('every selectable exercise has muscles and a description; unknown historical names stay unknown',()=>{
 assert.equal(new Set(T.catalog.map(e=>e.id)).size,14);for(const e of T.catalog){assert.ok(e.muscles);assert.ok(e.description);}
 assert.equal(T.exerciseInfo({id:'ex-old',name:'Пулловер'}).id,'pullover');assert.equal(T.exerciseInfo({id:'ex-other',name:'Неизвестное упражнение'}),null);
});
test('an existing active session accepts exercises added to its current program',async()=>{
 const {client,remote}=await setup(),a=await client();
 await a.store.mutate('save',{id:'active-current',workoutId:'2',date:'2026-11-26',exercises:[{exerciseId:'lat-pulldown',setDetails:[{weight:50,reps:12,done:true}]}]});
 await a.store.saveProgram('2',[...list(a.store),ex('pullover')],list(a.store));
 const current=a.store.data().history.find(s=>s.id==='active-current');
 await a.store.mutate('save',{...current,exercises:[...current.exercises,{exerciseId:'pullover',setDetails:[{weight:8,reps:10,done:true}]}]});
 assert.equal(remote.read().entries.find(s=>s.id==='active-current').exercises.length,2);
});
