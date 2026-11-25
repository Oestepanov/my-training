const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(__dirname+'/github-app.js','utf8');
const start=source.indexOf('/* BEGIN embedded Excel export');
const end=source.indexOf('/* END embedded Excel export */')+'/* END embedded Excel export */'.length;
const handler=source.slice(source.indexOf("$('#exportButton').textContent="),source.indexOf('let timerLength='));
test('a cached HTML page without an Excel script can download an Excel workbook',async()=>{
 let downloaded=0,blob,anchor;
 const button={textContent:'Скачать записи'};
 const context={TextEncoder,Uint8Array,Uint32Array,DataView,Blob,
  state:{workouts:[{id:'1',name:'Тренировка №1',exercises:[]}],history:[{date:'2026-11-25',workoutId:'1',exercises:[{name:'Жим лёжа',exerciseId:'bench',weight:47,reps:12,sets:3,completed:true}]}]},
  $:()=>button,today:()=>'2026-11-25',toast(message,error){assert.ok(!error,message);},setTimeout(){},
  document:{body:{append(){}},createElement(){anchor={click(){downloaded++;},remove(){}};return anchor;}},
  URL:{createObjectURL(value){blob=value;return'blob:test';},revokeObjectURL(){}}
 };
 vm.createContext(context);assert.equal(context.TrainingExcel,undefined);
 assert.ok(start>=0&&end>start);
 vm.runInContext(source.slice(start,end)+'\n'+handler,context);
 assert.equal(button.textContent,'Скачать Excel');
 button.onclick();assert.equal(downloaded,1);
 assert.equal(anchor.download,'trenirovki-2026-11-25.xlsx');
 assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
});
test('export of an empty diary gives a message instead of an empty download',()=>{
 const button={};let notice='';
 const context={TextEncoder,Uint8Array,Uint32Array,DataView,state:{history:[]},$:()=>button,toast:message=>{notice=message;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\n'+handler,context);
 button.onclick();assert.match(notice,/нет сохранённых тренировок/);
});
