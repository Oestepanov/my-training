const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.crypto=require('node:crypto').webcrypto;
const T=require('./github-store.js');
const copy=x=>structuredClone(x);
const workouts=[{id:'1',name:'Тренировка №1',exercises:[{id:'bench',name:'Жим'},{id:'curl',name:'Сгибание рук'}]},{id:'2',name:'Тренировка №2',exercises:[{id:'row',name:'Тяга'}]}];
const history={id:'old-session',workoutId:'1',date:'2026-11-20',version:1,exercises:[{exerciseId:'bench',name:'Жим',setDetails:[{weight:47,reps:12,done:true}],completed:true,sets:1,weight:47,reps:12}]};
async function setup(){
 const key=T.bytesTo64(crypto.getRandomValues(new Uint8Array(32)));
 let doc={schemaVersion:3,workouts:copy(workouts),entries:[copy(history)]},sha=1,writes=0,loseResponse=false;
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
const list=(s,id='1')=>copy(s.data().workouts.find(w=>w.id===id).exercises);
test('add, rename and replace synchronize between independent devices without rewriting history',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();
 const base=list(a.store),edited=[{...base[0],name:'Жим штанги'}, {id:'new-exercise',name:'Пуловер'}];
 await a.store.saveProgram('1',edited,base);await b.store.sync();
 assert.deepEqual(list(b.store),edited);assert.deepEqual(remote.read().entries,[history]);
 assert.deepEqual(b.store.doc.workouts[0].archivedExercises,[workouts[0].exercises[1]]);
 const old=copy(history);old.exercises[0].setDetails[0].reps=13;
 await b.store.mutate('save',old);
 assert.equal(remote.read().entries[0].exercises[0].name,'Жим');
 assert.equal(remote.read().entries[0].exercises[0].reps,13);
});
test('offline edits survive restart, coalesce, and merge with another device session',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();a.online=false;
 let base=list(a.store);await a.store.saveProgram('1',[...base,{id:'extra',name:'Новое'}],base);
 base=list(a.store);base[0].name='Переименовано';await a.store.saveProgram('1',base,list(a.store));
 assert.equal(a.store.pendingCount,1);a.reopen();assert.equal(a.store.pendingCount,1);
 await assert.rejects(()=>a.store.disconnect());
 await b.store.mutate('save',{id:'another-session',workoutId:'2',date:'2026-11-25',exercises:[{exerciseId:'row',setDetails:[{weight:50,reps:12,done:true}]}]});
 a.online=true;await a.store.sync();await b.store.sync();
 assert.deepEqual(list(a.store),list(b.store));assert.equal(list(b.store)[0].name,'Переименовано');
 assert.equal(remote.read().entries.length,2);assert.equal(a.store.pendingCount,0);
});
test('concurrent edits to the same workout need an explicit choice',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();
 const original=list(a.store),left=copy(original),right=copy(original);left[0].name='Вариант А';right[0].name='Вариант Б';
 await a.store.saveProgram('1',left,original);await b.store.saveProgram('1',right,original);
 assert.equal(b.store.status.kind,'conflict');assert.equal(b.store.pendingCount,1);assert.deepEqual(remote.read().workouts[0].exercises,left);
 await b.store.resolve('program-1','local');assert.deepEqual(remote.read().workouts[0].exercises,right);assert.equal(b.store.pendingCount,0);
 assert.deepEqual(remote.read().entries,[history]);
});
test('keeping the remote program discards only its local edit',async()=>{
 const {client,remote}=await setup(),a=await client(),b=await client();
 const original=list(a.store),left=copy(original),right=copy(original);left[0].name='А';right[0].name='Б';
 await a.store.saveProgram('1',left,original);await b.store.saveProgram('1',right,original);
 await b.store.resolve('program-1','remote');assert.deepEqual(list(b.store),left);assert.deepEqual(remote.read().entries,[history]);
});
test('different workouts merge without a false conflict',async()=>{
 const {client}=await setup(),a=await client(),b=await client();
 const first=list(a.store),second=list(b.store,'2');
 await a.store.saveProgram('1',[...first,{id:'extra-a',name:'А'}],first);
 await b.store.saveProgram('2',[...second,{id:'extra-b',name:'Б'}],second);
 await a.store.sync();assert.equal(a.store.conflicts.length,0);assert.equal(list(a.store).length,3);assert.equal(list(a.store,'2').length,2);
});
test('a lost success response is acknowledged without a duplicate write',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store);remote.loseResponse();
 await a.store.saveProgram('1',[...base,{id:'extra',name:'Добавлено'}],base);
 assert.equal(a.store.pendingCount,1);a.reopen();await a.store.sync();
 assert.equal(a.store.pendingCount,0);assert.equal(remote.writes(),1);assert.equal(list(a.store).length,3);
});
test('removed exercises can still be saved from a workout started before a program edit',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store);
 await a.store.saveProgram('1',[base[0]],base);
 await a.store.mutate('save',{id:'started-earlier',workoutId:'1',date:'2026-11-25',exercises:base.map(e=>({exerciseId:e.id,setDetails:[{weight:10,reps:12,done:true}]}))});
 assert.equal(remote.read().entries.find(e=>e.id==='started-earlier').exercises.length,2);
 assert.deepEqual(list(a.store),[base[0]]);
});
test('invalid or stale program edits never replace the saved list',async()=>{
 const {client,remote}=await setup(),a=await client(),base=list(a.store);
 for(const invalid of [[],[{id:'new',name:'   '}],[base[0],base[0]],Array.from({length:41},(_,i)=>({id:'e'+i,name:'Test'}))])await assert.rejects(()=>a.store.saveProgram('1',invalid,base));
 assert.deepEqual(list(a.store),base);assert.equal(remote.writes(),0);
 await a.store.saveProgram('1',[base[0]],base);
 await assert.rejects(()=>a.store.saveProgram('1',base,base));assert.deepEqual(list(a.store),[base[0]]);
});
