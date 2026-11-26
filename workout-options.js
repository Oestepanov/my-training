(function(root){
 'use strict';
 const key='my-training-options-v1';
 function validate(value={}){return{showSets:value.showSets===true,defaultSets:Number.isInteger(value.defaultSets)&&value.defaultSets>=1&&value.defaultSets<=12?value.defaultSets:3};}
 function read(storage=root.localStorage){try{return validate(JSON.parse(storage.getItem(key)||'{}'));}catch{return validate();}}
 function write(value,storage=root.localStorage){const next=validate(value);storage.setItem(key,JSON.stringify(next));return next;}
 function initialRows(previous,options){
  const count=options.showSets?options.defaultSets:3;
  const done=previous?.setDetails?.filter(s=>s.done)||[];
  const source=done.length?done:previous?.completed?Array.from({length:previous.sets||3},()=>({weight:previous.weight||0,reps:previous.reps||12})):[];
  return Array.from({length:count},(_,i)=>{const s=source[i]||source.at(-1);return{weight:s?.weight??0,reps:s?.reps||12,done:false};});
 }
 root.WorkoutOptions={key,read,write,validate,initialRows};if(typeof module!=='undefined')module.exports=root.WorkoutOptions;
})(globalThis);
