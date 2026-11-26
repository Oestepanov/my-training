const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('./android/app/src/main/assets/www/training-drafts.js');
const copy=x=>structuredClone(x);
function memory(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
const sample={id:'draft-a',version:2,workoutId:'2',date:'2026-11-26',notes:'Моя заметка',exercises:[{exerciseId:'pullover',name:'Пуловер',setDetails:[{weight:8,reps:10,done:true,rawWeight:'8',rawReps:'10'},{weight:0,reps:0,done:false,rawWeight:'',rawReps:''}]}]};
test('weights, repetitions, checked sets, notes, mode and base version survive a new store instance',()=>{
 const storage=memory(),a=new D.Store(storage);a.save(sample,{editing:true,mode:'history'});
 const b=new D.Store(storage);assert.deepEqual(b.active().session,sample);assert.equal(b.active().mode,'history');assert.equal(b.active().editing,true);assert.equal(b.active().session.exercises[0].setDetails[1].rawWeight,'');
});
test('native backup restores drafts when WebView storage is empty',()=>{
 const a=new D.Store(memory());a.save(sample,{editing:true});const native=a.serialize();const b=new D.Store(memory());b.merge(native);assert.deepEqual(b.active().session,sample);
});
test('a stale native backup cannot resurrect a discarded or submitted draft',()=>{
 const storage=memory(),a=new D.Store(storage);a.save(sample);const old=a.serialize();a.remove(sample.id);a.merge(old);assert.equal(a.get(sample.id),null);assert.equal(new D.Store(storage).get(sample.id),null);
});
test('newer local input wins over an older native snapshot and independent drafts are preserved',()=>{
 const a=new D.Store(memory());a.save(sample);const old=a.serialize(),changed=copy(sample);changed.notes='Новее';a.save(changed);a.save({...sample,id:'draft-b',workoutId:'3'});a.merge(old);assert.equal(a.get(sample.id).session.notes,'Новее');assert.ok(a.get('draft-b'));
});
test('repeated fallback flushes keep the same revision when input did not change',()=>{
 const a=new D.Store(memory());const first=a.save(sample,{editing:true}),second=a.save(sample,{editing:true});assert.equal(first.revision,second.revision);
});
test('successful Save is recognized after an interruption, without creating a duplicate session',()=>{
 const a=new D.Store(memory()),valid=copy(sample);valid.exercises[0].setDetails.pop();a.save(valid,{editing:true});const committed=copy(valid);committed.version=3;for(const s of committed.exercises[0].setDetails){delete s.rawWeight;delete s.rawReps}a.reconcile([committed]);assert.equal(a.get(valid.id),null);
});
test('another device changing the same session does not discard the local draft or its base version',()=>{
 const a=new D.Store(memory());a.save(sample,{editing:true});const changed=copy(sample);changed.version=3;changed.notes='Изменено другим устройством';a.reconcile([changed]);assert.equal(a.get(sample.id).session.version,2);
});
test('version 1.2 browser drafts migrate without losing inputs',()=>{
 const storage=memory();storage.setItem('my-training-draft-v2-2',JSON.stringify(sample));const a=new D.Store(storage);a.importLegacy(['1','2','3']);assert.deepEqual(a.active().session,sample);assert.equal(storage.getItem('my-training-draft-v2-2'),null);
});
test('a quota failure is not falsely acknowledged as saved and does not replace the previous snapshot',()=>{
 const storage=memory(),a=new D.Store(storage);a.save(sample);storage.setItem=()=>{throw Error('quota')};assert.throws(()=>a.save({...sample,notes:'Не сохранилось'}));assert.deepEqual(a.get(sample.id).session,sample);
});
