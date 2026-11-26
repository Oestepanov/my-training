/* Local-only working copies. This module never calls a server. */
(function(root){
 'use strict';
 const KEY='my-training-drafts-v3',copy=x=>JSON.parse(JSON.stringify(x));
 const empty=()=>({version:3,clock:0,items:{},deleted:{},focus:null});
 function parse(value){
  if(!value)return empty();const data=typeof value==='string'?JSON.parse(value):copy(value);
  if(data.version!==3||!data.items||!data.deleted)throw Error('Не удалось прочитать черновики на устройстве.');
  for(const [id,item] of Object.entries(data.items))if(item.session?.id!==id||!item.session.workoutId||!Array.isArray(item.session.exercises)||!Number.isFinite(item.revision))throw Error('Черновик повреждён. Данные не заменены.');
  return data;
 }
 function payload(session){
  return {id:session.id,workoutId:session.workoutId,date:session.date,notes:session.notes||'',exercises:session.exercises.map(e=>({exerciseId:e.exerciseId,setDetails:(e.setDetails||[]).map(s=>({weight:Number(s.rawWeight??s.weight),reps:Number(s.rawReps??s.reps),done:!!s.done}))}))};
 }
 function matches(a,b){
  if(!a||!b)return false;
  if(a.exercises.some(e=>(e.setDetails||[]).some(s=>s.rawWeight===''||s.rawReps==='')))return false;
  return JSON.stringify(payload(a))===JSON.stringify(payload(b));
 }
 class Store{
  constructor(storage=root.localStorage){this.storage=storage;this.state=parse(storage.getItem(KEY));}
  get clock(){return Math.max(Date.now(),this.state.clock+1);}
  commit(next){this.storage.setItem(KEY,JSON.stringify(next));this.state=next;if(root.dispatchEvent&&root.Event)root.dispatchEvent(new root.Event('training-drafts-changed'));}
  get(id){return this.state.items[id]?copy(this.state.items[id]):null;}
  active(){return this.get(this.state.focus?.id);}
  forWorkout(id){
   const entries=Object.values(this.state.items).filter(e=>e.session.workoutId===id).sort((a,b)=>Number(a.editing)-Number(b.editing)||b.revision-a.revision);
   return entries[0]?copy(entries[0]):null;
  }
  save(session,{editing=false,mode='active'}={}){
   const previous=this.get(session.id);
   if(previous&&JSON.stringify(previous.session)===JSON.stringify(session)&&previous.editing===editing&&previous.mode===mode&&this.state.focus?.id===session.id)return previous;
   const next=copy(this.state),revision=this.clock;
   const item={session:copy(session),editing,mode,revision,savedAt:revision};
   next.items[session.id]=item;delete next.deleted[session.id];next.clock=revision;next.focus={id:session.id,workoutId:session.workoutId,revision};this.commit(next);return copy(item);
  }
  remove(id){
   if(!this.state.items[id])return;const next=copy(this.state),revision=this.clock;
   delete next.items[id];next.deleted[id]=revision;next.clock=revision;
   if(next.focus?.id===id)next.focus={...next.focus,id:null,revision};this.commit(next);
  }
  clearAll(){for(const id of Object.keys(this.state.items))this.remove(id);}
  reconcile(history){for(const item of Object.values(this.state.items)){const current=history.find(s=>s.id===item.session.id);if(matches(item.session,current))this.remove(item.session.id);}}
  serialize(){return JSON.stringify(this.state);}
  merge(value){
   const other=parse(value),next=copy(this.state);
   for(const [id,revision] of Object.entries(other.deleted))next.deleted[id]=Math.max(next.deleted[id]||0,revision);
   for(const [id,item] of Object.entries(other.items))if(!next.items[id]||item.revision>next.items[id].revision)next.items[id]=item;
   for(const [id,item] of Object.entries(next.items))if((next.deleted[id]||0)>=item.revision)delete next.items[id];
   if((other.focus?.revision||0)>(next.focus?.revision||0))next.focus=other.focus;
   next.clock=Math.max(next.clock,other.clock);this.commit(next);
  }
  importLegacy(workoutIds){
   for(const id of workoutIds){const key='my-training-draft-v2-'+id,raw=this.storage.getItem(key);if(!raw)continue;
    const session=JSON.parse(raw);if(session?.id&&Array.isArray(session.exercises)&&!this.state.items[session.id]&&!this.state.deleted[session.id])this.save(session);
    this.storage.removeItem(key);
   }
  }
 }
 root.TrainingDrafts={Store,key:KEY,matches};if(typeof module!=='undefined')module.exports=root.TrainingDrafts;
})(globalThis);
