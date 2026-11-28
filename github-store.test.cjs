const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {GitHubStore,encrypt,decrypt}=require('./github-store.js');
const KEY=crypto.randomBytes(32).toString('base64url'),TOKEN='github_pat_'+('test'.repeat(15));
const workouts=[{id:'1',name:'Тренировка №1',exercises:[{id:'bench',name:'Жим лёжа'}]}];
const initial=()=>({schemaVersion:3,workouts,entries:[]});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};};
const session=(id,weight=47,version=null)=>({id,date:'2026-11-25',workoutId:'1',version,notes:'Самочувствие отличное',exercises:[{exerciseId:'bench',setDetails:[{weight,reps:12,done:true}]}]});
async function server(){
 let envelope=await encrypt(initial(),KEY,crypto.webcrypto),sha=1,online=true,conflictOnce=false,loseResponse=false;
 const requests=[];
 const fetch=async(url,options)=>{
  requests.push({url,options});
  assert.ok(url.startsWith('https://api.github.com/repos/Oestepanov/my-training/'));
  if(!online)throw new TypeError('offline');
  if(options.headers.Authorization!=='Bearer '+TOKEN)return new Response('{}',{status:401});
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);
   assert.equal(body.branch,'training-data');
   assert.equal(options.body.includes('Самочувствие'),false);
   if(conflictOnce){conflictOnce=false;sha++;return new Response('{}',{status:409});}
   if(body.sha!==String(sha))return new Response('{}',{status:409});
   envelope=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));sha++;
   if(loseResponse){loseResponse=false;throw new TypeError('response lost');}
   return Response.json({content:{sha:String(sha)}});
  }
  return Response.json({sha:String(sha),encoding:'base64',content:Buffer.from(JSON.stringify(envelope)).toString('base64')});
 };
 return {fetch,requests,doc:()=>decrypt(envelope,KEY,crypto.webcrypto),online:v=>online=v,collision:()=>conflictOnce=true,loseResponse:()=>loseResponse=true};
}
const device=(s,st=storage())=>new GitHubStore({storage:st,fetch:s.fetch,crypto:crypto.webcrypto,workouts,lock:fn=>fn()});
const connect=d=>d.connect({token:TOKEN,key:KEY});

test('encrypted Unicode records round trip; a different recovery key is rejected',async()=>{
 const doc=initial();doc.entries.push({...session('a'),version:1});
 const encrypted=await encrypt(doc,KEY,crypto.webcrypto);
 assert.equal(JSON.stringify(encrypted).includes('Жим'),false);
 assert.deepEqual(await decrypt(encrypted,KEY,crypto.webcrypto),doc);
 await assert.rejects(decrypt(encrypted,crypto.randomBytes(32).toString('base64url'),crypto.webcrypto),/не подходит/);
});
test('saving on the first device appears on a second device; only ciphertext is sent',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await connect(b);
 assert.equal((await a.mutate('save',session('one'))).synced,true);
 await b.sync();assert.equal(b.data().history[0].exercises[0].weight,47);
 assert.equal(b.data().history[0].notes,'Самочувствие отличное');
});
test('offline queue survives reload and merges with a different record from another device',async()=>{
 const s=await server(),st=storage(),a=device(s,st),b=device(s);await connect(a);await connect(b);
 s.online(false);const saved=await a.mutate('save',session('one'));assert.equal(saved.synced,false);
 const reopened=device(s,st);assert.equal(reopened.data().history.length,1);assert.equal(reopened.pending.length,1);
 s.online(true);await b.mutate('save',session('two',52));await reopened.sync();
 assert.deepEqual((await s.doc()).entries.map(e=>e.id).sort(),['one','two']);assert.equal(reopened.pending.length,0);
});
test('simultaneous distinct writes retry the SHA lease without losing either session',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await connect(b);
 await Promise.all([a.mutate('save',session('one')),b.mutate('save',session('two'))]);
 assert.deepEqual((await s.doc()).entries.map(e=>e.id).sort(),['one','two']);
});
test('concurrent edits of the same record are held for an explicit conflict decision',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await a.mutate('save',session('one'));await connect(b);
 s.online(false);await b.mutate('save',session('one',50,b.data().history[0].version));
 s.online(true);await a.mutate('save',session('one',55,a.data().history[0].version));await b.sync();
 assert.equal(b.status.kind,'conflict');assert.equal((await s.doc()).entries[0].exercises[0].weight,55);assert.equal(b.pending.length,1);
 await b.resolve('one','remote');assert.equal(b.data().history[0].exercises[0].weight,55);assert.equal(b.pending.length,0);
});
test('explicit local conflict choice updates the latest remote version',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await a.mutate('save',session('one'));await connect(b);
 s.online(false);await b.mutate('save',session('one',50,b.data().history[0].version));
 s.online(true);await a.mutate('save',session('one',55,a.data().history[0].version));await b.sync();await b.resolve('one','local');
 assert.equal((await s.doc()).entries[0].exercises[0].weight,50);
});
test('delete and restore synchronize as tombstones, without resurrecting stale data',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await a.mutate('save',session('one'));await connect(b);
 await a.mutate('delete',{id:'one',version:a.data().history[0].version});await b.sync();
 assert.equal(b.data().history.length,0);assert.equal(b.data().trash.length,1);
 await b.mutate('restore',{id:'one',version:b.data().trash[0].version});await a.sync();assert.equal(a.data().history.length,1);
});
test('lost successful PUT response does not duplicate or conflict on retry',async()=>{
 const s=await server(),a=device(s);await connect(a);s.loseResponse();await a.mutate('save',session('one'));
 assert.equal(a.pending.length,1);await a.sync();assert.equal(a.pending.length,0);assert.equal((await s.doc()).entries.length,1);
});
test('SHA conflicts are retried; stale form versions cannot overwrite a newer session',async()=>{
 const s=await server(),a=device(s);await connect(a);s.collision();await a.mutate('save',session('one'));
 const version=a.data().history[0].version;await a.mutate('save',session('one',50,version));
 await assert.rejects(a.mutate('save',session('one',60,version)),/уже изменилась/);
});
test('pairing a second device, bad token rejection, and no disconnect while offline edits are queued',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);await b.connect({code:a.connectionCode()});assert.equal(b.connected,true);
 const c=device(s);await assert.rejects(c.connect({token:'github_pat_'+('bad'.repeat(20)),key:KEY}),/отклонил/);assert.equal(c.connected,false);
 s.online(false);await a.mutate('save',session('one'));await assert.rejects(a.disconnect(),/ожидающие/);assert.equal(a.connected,true);
});
test('local storage failure never confirms or transmits the proposed result',async()=>{
 const s=await server(),st=storage(),a=device(s,st);await connect(a);
 st.setItem=()=>{throw new Error('quota');};const count=s.requests.length;
 await assert.rejects(a.mutate('save',session('one')),/Память/);assert.equal(s.requests.length,count);assert.equal(a.data().history.length,0);
});

test('a saved session can replace, add and remove catalog exercises while preserving the program and other sessions',async()=>{
 const s=await server(),a=device(s),b=device(s);await connect(a);
 await a.mutate('save',session('older'));
 await a.mutate('save',session('corrected'));
 await connect(b);
 const originalWorkouts=structuredClone(a.data().workouts);
 const corrected=a.data().history.find(e=>e.id==='corrected');
 s.online(false);
 await a.mutate('save',{...corrected,exercises:[
  {exerciseId:'machine-chest-press',name:'ignored user label',setDetails:[{weight:20,reps:15,done:true}]},
  {exerciseId:'seated-cable-row',setDetails:[{weight:35,reps:12,done:true}]}
 ]});
 assert.equal(a.pending.length,1);
 s.online(true);await a.sync();await b.sync();
 const history=b.data().history,edited=history.find(e=>e.id==='corrected');
 assert.equal(edited.version,corrected.version+1);
 assert.deepEqual(edited.exercises.map(e=>e.exerciseId),['machine-chest-press','seated-cable-row']);
 assert.equal(edited.exercises[0].name,'Жим от груди в тренажёре');
 assert.equal(edited.exercises[0].weight,20);
 assert.equal(history.find(e=>e.id==='older').exercises[0].exerciseId,'bench');
 assert.deepEqual(b.data().workouts,originalWorkouts);
 await assert.rejects(a.mutate('save',{...edited,exercises:[{exerciseId:'unknown-exercise',setDetails:[{weight:20,reps:15,done:true}]}]}),/Список упражнений/);
});

