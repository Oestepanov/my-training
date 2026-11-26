const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('./workout-options.js');
test('simple mode always starts with three unchecked sets, even after an older custom count',()=>{
 const result=O.initialRows({completed:true,weight:8,reps:10,sets:5},{showSets:false,defaultSets:5});assert.equal(result.length,3);assert.ok(result.every(s=>s.weight===8&&s.reps===10&&!s.done));
});
test('advanced mode uses the selected default and retains different previous loads',()=>{
 const prev={setDetails:[{weight:50,reps:15,done:true},{weight:55,reps:8,done:true},{weight:52,reps:8,done:true}]};const result=O.initialRows(prev,{showSets:true,defaultSets:4});assert.deepEqual(result.map(s=>s.weight),[50,55,52,52]);assert.ok(result.every(s=>!s.done));assert.equal(prev.setDetails.length,3);
});
test('options persist on this device and invalid settings recover to safe defaults',()=>{
 let stored=null;const storage={getItem:()=>stored,setItem:(k,v)=>stored=v};assert.deepEqual(O.read(storage),{showSets:false,defaultSets:3});O.write({showSets:true,defaultSets:4},storage);assert.deepEqual(O.read(storage),{showSets:true,defaultSets:4});stored='{';assert.deepEqual(O.read(storage),{showSets:false,defaultSets:3});assert.equal(O.validate({showSets:true,defaultSets:0}).defaultSets,3);
});
