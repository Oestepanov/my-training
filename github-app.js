'use strict';
/* BEGIN embedded Excel export: supports cached page markup. */
/* Local Excel export. No network requests or external dependencies. */
(function(root){
 'use strict';
 const encoder=new TextEncoder();
 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const xml=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').slice(0,32767).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const numeric=value=>typeof value==='number'&&Number.isFinite(value)?value:0;
 const column=index=>{let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
 function dateCell(value){
  const ms=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T00:00:00Z'):NaN;
  return Number.isFinite(ms)?{value:ms/86400000+25569,style:2}:{value:String(value||'')};
 }
 function cell(value,style=0){return{value,style};}
 function performed(exercise){
  if(Array.isArray(exercise.setDetails))return exercise.setDetails.map((s,i)=>({...s,index:i+1})).filter(s=>s.done===true);
  if(!exercise.completed)return[];
  const count=Number.isInteger(exercise.sets)&&exercise.sets>0?exercise.sets:3;
  return Array.from({length:count},(_,i)=>({index:i+1,weight:numeric(exercise.weight),reps:numeric(exercise.reps)}));
 }
 function sheetsFor(state){
  const workouts=new Map((state.workouts||[]).map(w=>[String(w.id),w]));
  const summary=[['Дата','Тренировка','Упражнений выполнено','Подходов выполнено','Всего повторений','Объём, кг × повторы','Заметка'].map(v=>cell(v,1))];
  const detail=[['Дата','Тренировка','Упражнение','Подход','Вес, кг','Повторения','Объём, кг × повторы'].map(v=>cell(v,1))];
  const sessions=[...(state.history||[])].filter(s=>!s.deleted).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||a.id).localeCompare(String(b.createdAt||b.id)));
  for(const session of sessions){
   const workout=workouts.get(String(session.workoutId));
   const workoutName=workout?.name||'Тренировка №'+session.workoutId;
   let exerciseCount=0,setCount=0,reps=0,volume=0;
   for(const exercise of session.exercises||[]){
    const sets=performed(exercise);if(!sets.length)continue;
    const name=exercise.name||workout?.exercises?.find(e=>e.id===exercise.exerciseId)?.name||exercise.exerciseId;
    exerciseCount++;
    for(const set of sets){
     const weight=numeric(set.weight),repeat=numeric(set.reps),work=Math.round(weight*repeat*100)/100;
     setCount++;reps+=repeat;volume+=work;
     detail.push([dateCell(session.date),cell(workoutName),cell(name),cell(set.index,4),cell(weight,3),cell(repeat,4),cell(work,3)]);
    }
   }
   summary.push([dateCell(session.date),cell(workoutName),cell(exerciseCount,4),cell(setCount,4),cell(reps,4),cell(Math.round(volume*100)/100,3),cell(session.notes||'')]);
  }
  return[
   {name:'Тренировки',rows:summary,widths:[14,23,23,23,21,25,44]},
   {name:'Подходы',rows:detail,widths:[14,23,37,12,14,17,25]}
  ];
 }
 function sheetXML(sheet){
  const rows=sheet.rows;
  if(rows.length>1048576)throw new Error('Слишком много строк для одного листа Excel.');
  const last=column(sheet.widths.length-1)+rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<worksheet xmlns="'+NS+'"><dimension ref="A1:'+last+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/>'+
   '<cols>'+sheet.widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+
   rows.map((row,i)=>'<row r="'+(i+1)+'"'+(!i?' ht="32" customHeight="1"':'')+'>'+row.map((c,j)=>{
    const ref=column(j)+(i+1),attrs=' r="'+ref+'" s="'+(c.style||0)+'"';
    return typeof c.value==='number'&&Number.isFinite(c.value)?'<c'+attrs+'><v>'+c.value+'</v></c>':'<c'+attrs+' t="inlineStr"><is><t xml:space="preserve">'+xml(c.value)+'</t></is></c>';
   }).join('')+'</row>').join('')+'</sheetData><autoFilter ref="A1:'+last+'"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
 }
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="'+NS+'"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF263A25"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
 function zip(files){
  const local=[],central=[];let offset=0,size=0;
  for(const [path,text]of files){
   const name=encoder.encode(path),body=encoder.encode(text),crc=crc32(body);
   const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
   view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);view.setUint32(14,crc,true);view.setUint32(18,body.length,true);view.setUint32(22,body.length,true);view.setUint16(26,name.length,true);header.set(name,30);
   local.push(header,body);
   const entry=new Uint8Array(46+name.length),cv=new DataView(entry.buffer);
   cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);entry.set(name,46);
   central.push(entry);offset+=header.length+body.length;size+=entry.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  const output=new Uint8Array(offset+size+end.length);let cursor=0;
  for(const part of [...local,...central,end]){output.set(part,cursor);cursor+=part.length;}
  return output;
 }
 function buildWorkbook(state){
  const sheets=sheetsFor(state),relsNS='http://schemas.openxmlformats.org/package/2006/relationships';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+relsNS+'">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  return zip([
   ['[Content_Types].xml',types],
   ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+relsNS+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
   ['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles],
   ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(s)])
  ]);
 }
 root.TrainingExcel={buildWorkbook,mimeType:MIME};
 if(typeof module!=='undefined')module.exports=root.TrainingExcel;
})(globalThis);

/* END embedded Excel export */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state={workouts:[],history:[],editable:false},workoutId='1',editId=null,editVersion=null,draftId=crypto.randomUUID(),dirty=false,pinMode='unlock',showTrash=false;
const desc={'1':'Грудь · ноги · руки','2':'Спина · плечи · грудь','3':'Грудь · руки'};
const muscles={'bench-press':'Грудь · трицепс','leg-press':'Квадрицепс · ягодицы','seated-hammer-curl':'Бицепс · предплечья','lying-leg-curl':'Задняя поверхность бедра','barbell-wrist-curl':'Предплечья','incline-bench-press':'Верх груди · трицепс','lat-pulldown':'Широчайшие мышцы спины','lateral-raise':'Средние дельты','reverse-pec-deck':'Задние дельты','assisted-pull-up':'Гравитрон · вес помощи','dumbbell-curl':'Бицепс','pec-deck':'Грудь','triceps-pushdown':'Трицепс','pullover':'Грудь · широчайшие'};
const hints={'bench-press':'Штанга: общий вес вместе с грифом.','leg-press':'Указывай вес на тренажёре одинаковым способом каждый раз.','seated-hammer-curl':'Вес одной гантели.','lateral-raise':'Вес одной гантели.','dumbbell-curl':'Вес одной гантели.','assisted-pull-up':'Это вес противовеса: меньше помощи — выше нагрузка.','pullover':'Вес одной гантели.'};
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function date(s){return new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});}
function number(v){return Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});}
function sets(e){return e?.setDetails||Array.from({length:e?.sets||3},()=>({weight:e?.weight??0,reps:e?.reps||12,done:Boolean(e?.completed)}));}
function doneSets(e){return sets(e).filter(s=>s.done);}
function latest(id){for(const s of state.history){const e=s.exercises.find(e=>TrainingGitHub.exerciseKey(e)===id&&e.completed);if(e?.completed&&s.id!==editId)return{...e,date:s.date};}return null;}
let toastTimeout;function toast(text,error=false){$('#toast').textContent=text;$('#toast').classList.toggle('error-toast',error);$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').hidden=true,error?8000:4500);}
const githubStore=new TrainingGitHub.GitHubStore({workouts:window.TRAINING_PROGRAM||[]});
const drafts=new TrainingDrafts.Store();
let uiOptions=WorkoutOptions.read();
document.body.classList.toggle('show-sets',uiOptions.showSets);
let editHistory=false,retainedExercises=[],draftError='',savingSession=false;
async function request(path,body){
 try{
  if(path==='/api/data')return githubStore.data();
  if(path==='/api/session')return await githubStore.mutate('save',body);
  if(path==='/api/delete')return await githubStore.mutate('delete',body);
  if(path==='/api/restore')return await githubStore.mutate('restore',body);
  throw new Error('Неизвестная операция.');
 }finally{renderSyncStatus();}
}
async function refresh(){state=await request('/api/data');updateAccess();renderPicker();renderHistory();}
function updateAccess(){
 $('#accessLabel').textContent=state.editable?'Синхронизация':'Подключить GitHub';
 $('#accessButton').classList.toggle('unlocked',state.editable);
 $('#saveButton').textContent=editId&&editHistory?'Сохранить изменения':'Сохранить тренировку';
 $('#saveButton').disabled=!state.editable||savingSession;
 if($('#editProgram'))$('#editProgram').disabled=!state.editable||savingSession;
 $('#saveHint').textContent=state.editable?(editHistory?'Проверь упражнения и результаты, затем нажми «Сохранить изменения».':'Изменения сразу сохраняются на телефоне. На GitHub — только после нажатия «Сохранить тренировку».'):'Подключи GitHub, чтобы загрузить историю и сохранять результаты.';
 $$('#exerciseList input, #exerciseList button, #sessionDate, #notes').forEach(e=>e.disabled=!state.editable||savingSession);
 $('#continueWorkout').disabled=savingSession;renderOptions();renderSyncStatus();
}
function renderPicker(){
 $('#workoutPicker').innerHTML=state.workouts.map(w=>'<button class="workout-option '+(w.id===workoutId?'selected':'')+'" data-workout="'+escape(w.id)+'" aria-label="'+escape(w.name)+'" aria-pressed="'+(w.id===workoutId)+'">№'+escape(w.id)+'</button>').join('');
 $$('[data-workout]').forEach(b=>b.onclick=()=>switchWorkout(b.dataset.workout));renderWeek();
}
function renderWeek(){
 const base=new Date(today()+'T12:00:00');base.setDate(base.getDate()-((base.getDay()+6)%7));
 const labels=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
 $('#weekStrip').innerHTML=labels.map((label,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const id=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10),trained=state.history.some(s=>s.date===id&&s.exercises.some(e=>doneSets(e).length));return '<div class="week-day '+(id===today()?'today ':'')+(trained?'trained':'')+'"><span>'+label+'</span><strong>'+d.getDate()+'</strong><span class="week-mark">'+(trained?'✓':'')+'</span></div>';}).join('');
}
const checkIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>';
function exerciseIcon(id){
 const paths=id==='lat-pulldown'?'<path d="M8 7h32M12 7v31M36 7v31M24 7v10M17 17h14M16 38h16M20 31h8M20 31v7"/>':id==='pullover'?'<path d="M7 32h27M9 32v8M32 32v8M14 28l11-3 9-10M34 15l5-1M36 10l5 8M16 25v5"/><circle cx="30" cy="22" r="3"/>':id.includes('press')?'<path d="M8 12h32M12 8v8M17 6v12M31 6v12M36 8v8M12 34h24M15 34v8M33 34v8M18 31l12-9M30 22v-5"/>':'<path d="M14 24h20M8 16v16M14 12v24M34 12v24M40 16v16M5 21v6M43 21v6"/>';
 return '<svg viewBox="0 0 48 48">'+paths+'</svg>';
}
function renderOptions(){
 $('#showSetControls').checked=uiOptions.showSets;$('#defaultSetsSection').hidden=!uiOptions.showSets;
 if(document.activeElement!==$('#defaultSetCount'))$('#defaultSetCount').value=uiOptions.defaultSets;
 document.body.classList.toggle('show-sets',uiOptions.showSets);
}
function saveOptions(next){
 try{uiOptions=WorkoutOptions.write(next);renderOptions();updateCompletion();}
 catch{toast('Не удалось сохранить настройки на этом устройстве.',true);renderOptions();}
}
function collect(raw=false){
 const visible=$$('.exercise').map(card=>({exerciseId:card.dataset.exercise,name:card.querySelector('h3').textContent,setDetails:[...card.querySelectorAll('.set-row')].map(row=>{const weight=row.querySelector('.weight').value,reps=row.querySelector('.reps').value;return {weight:Number(weight),reps:Number(reps),done:row.querySelector('.done-check').checked,...(raw?{rawWeight:weight,rawReps:reps}:{})};})}));
 const hidden=retainedExercises.map(e=>({...e,setDetails:sets(e).map(r=>raw?{...r}:{weight:Number(r.rawWeight??r.weight),reps:Number(r.rawReps??r.reps),done:!!r.done})}));
 return{id:editId||draftId,version:editVersion,date:$('#sessionDate').value,workoutId,notes:$('#notes').value,exercises:[...visible,...hidden]};
}
function renderDraftStatus(){
 const item=drafts.get(editId||draftId),banner=$('#draftBanner');if(!banner)return;
 banner.hidden=!item&&!draftError;$('#autoSaveStatus').hidden=!banner.hidden;$('#autoSaveStatus').textContent=state.editable?'Изменения сохраняются на телефоне':'Подключи дневник в настройках';banner.classList.toggle('draft-error',!!draftError);
 $('#draftMessage').textContent=draftError||(item?'Черновик сохранён · '+new Date(item.savedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'');
 $('#discardDraft').hidden=!item;$('#discardDraft').disabled=savingSession;
}
function persist(){
 dirty=true;
 try{drafts.save(collect(true),{editing:!!editId,mode:editHistory?'history':'active'});draftError='';}
 catch{draftError='Не удалось сохранить черновик на телефоне. Оставь приложение открытым и сохрани тренировку.';toast(draftError,true);}
 updateCompletion();renderDraftStatus();
}
window.flushTrainingDraft=()=>{if(dirty)persist();};
function switchWorkout(id){if(savingSession)return;if(dirty)persist();editId=null;editVersion=null;editHistory=false;workoutId=id;dirty=false;renderPicker();renderWorkout(undefined,undefined,'active');}
function discardDraft(){
 if(savingSession)return;
 if(!confirm('Сбросить только черновик на этом устройстве? Уже сохранённые результаты останутся в истории.'))return;
 try{drafts.remove(editId||draftId);draftError='';}catch{toast('Не удалось удалить черновик.',true);return;}
 editId=null;editVersion=null;editHistory=false;dirty=false;renderWorkout(undefined,undefined,'active');
}
function rowHTML(s,i){return '<div class="set-row '+(s.done?'done':'')+'"><span class="set-number">'+(i+1)+'</span><input aria-label="Вес в подходе '+(i+1)+'" class="weight" type="number" inputmode="decimal" min="0" max="1000" step="0.25" value="'+escape(s.rawWeight??s.weight)+'"><input aria-label="Повторы в подходе '+(i+1)+'" class="reps" type="number" inputmode="numeric" min="1" max="200" step="1" value="'+escape(s.rawReps??s.reps)+'"><input aria-label="Подход '+(i+1)+' выполнен" class="done-check" type="checkbox" '+(s.done?'checked':'')+'></div>';}
function renderWorkout(session,localOverride,modeOverride){
 if(modeOverride)editHistory=modeOverride==='history';
 const workout=state.workouts.find(w=>w.id===workoutId);if(!workout)return;
 const local=localOverride||(session?drafts.get(session.id):editId?drafts.get(editId):drafts.forWorkout(workoutId));
 if(local){session=local.session;editId=local.editing?session.id:null;editVersion=session.version??null;editHistory=(modeOverride||local.mode)==='history';dirty=true;}
 else{
  if(!session&&editId)session=state.history.find(s=>s.id===editId);
  if(!session&&!editId){const candidates=state.history.filter(s=>s.workoutId===workoutId&&s.date===today()&&s.exercises.some(e=>!e.completed));if(candidates.length===1){session=candidates[0];editHistory=false;}}
  if(session){editId=session.id;editVersion=session.version;}
 }
 const draft=session,historyView=editHistory&&!!editId;
 $('#sessionHeading').textContent=historyView?'Редактирование':'Сегодня';
 $('#editProgram').textContent=historyView?'Изменить упражнения':'Изменить';
 const exerciseList=historyView?draft.exercises.map(e=>({id:e.exerciseId,name:e.name})):workout.exercises;
 retainedExercises=!historyView&&draft?(draft.exercises||[]).filter(e=>!workout.exercises.some(x=>TrainingGitHub.exerciseKey(x)===TrainingGitHub.exerciseKey(e))):[];
 draftId=draft?.id||crypto.randomUUID();$('#sessionDate').value=draft?draft.date:today();$('#notes').value=draft?.notes||'';
 $('#workoutTitle').textContent='Упражнения';$('#workoutCount').textContent=exerciseList.length+(historyView?' в записи':' в программе');
 $('#editBanner').hidden=!historyView&&!retainedExercises.some(e=>doneSets(e).length);
 $('#cancelEdit').hidden=!historyView;
 $('#editBanner').textContent=historyView?'Редактирование занятия от '+date(draft.date):'Записанные результаты убранных упражнений остаются в истории.';
$('#exerciseList').innerHTML=exerciseList.map(ex=>{
 const info=TrainingGitHub.exerciseInfo(ex),exKey=TrainingGitHub.exerciseKey(ex),prev=latest(exKey);
 const saved=draft?.exercises?.find(e=>historyView?e.exerciseId===ex.id:TrainingGitHub.exerciseKey(e)===exKey);
 const legacyEmpty=saved&&saved.exerciseId!==exKey&&!saved.completed&&sets(saved).every(s=>!s.done&&s.weight===0&&s.reps===12);
 const rows=saved&&!legacyEmpty?sets(saved):WorkoutOptions.initialRows(prev,uiOptions);
 const previous=prev?doneSets(prev).map(s=>number(s.weight)+' кг × '+s.reps).join(' · '):'Пока нет прошлых результатов';
 return '<details class="exercise" data-exercise="'+escape(ex.id)+'" data-has-previous="'+!!prev+'"><summary class="exercise-summary"><span class="exercise-glyph" aria-hidden="true">'+exerciseIcon(exKey)+'</span><span class="exercise-summary-copy"><h3>'+escape(ex.name)+'</h3><span class="exercise-current"></span></span><button type="button" class="exercise-check" aria-label="Отметить упражнение выполненным">'+checkIcon+'</button><span class="exercise-chevron" aria-hidden="true">⌄</span></summary><div class="exercise-body"><p class="muscles">'+escape(info?.muscles||muscles[ex.id]||'')+'</p>'+(info?'<p class="exercise-description muted">'+escape(info.description)+'</p>':'')+'<p class="previous">В прошлый раз: <b>'+escape(previous)+'</b></p><div class="simple-entry"><label>Вес, кг<input class="bulk-weight" aria-label="Вес упражнения" type="number" inputmode="decimal" min="0" max="1000" step="0.25" value="'+escape(rows[0]?.rawWeight??rows[0]?.weight??0)+'"></label><label>Повторы<input class="bulk-reps" aria-label="Повторы упражнения" type="number" inputmode="numeric" min="1" max="200" step="1" value="'+escape(rows[0]?.rawReps??rows[0]?.reps??12)+'"></label></div><p class="mixed-note muted" hidden>Веса или повторы различаются. Отдельные значения доступны в настройке «Показывать подходы».</p><div class="advanced-set-fields"><div class="set-head"><span>Подход</span><span>Вес, кг</span><span>Повторы</span><span>Готово</span></div><div class="set-rows">'+rows.map(rowHTML).join('')+'</div><div class="set-actions"><button type="button" class="text-button add-set">+ Подход</button><button type="button" class="text-button remove-set">Убрать последний</button></div></div><button type="button" class="button primary exercise-done">Упражнение выполнено</button>'+(info?.hint?'<p class="muted hint">'+escape(info.hint)+'</p>':'')+'</div></details>';
}).join('');
$$('.exercise').forEach(card=>{
 card.addEventListener('input',event=>{
  if(event.target.classList.contains('bulk-weight'))card.querySelectorAll('.set-row .weight').forEach(e=>e.value=event.target.value);
  if(event.target.classList.contains('bulk-reps'))card.querySelectorAll('.set-row .reps').forEach(e=>e.value=event.target.value);
  persist();
 });
 const mark=()=>{
  if(!state.editable||savingSession)return;
  const boxes=[...card.querySelectorAll('.done-check')],done=boxes.every(e=>e.checked);boxes.forEach(e=>e.checked=!done);persist();
 };
 card.querySelector('.exercise-check').onclick=event=>{event.preventDefault();event.stopPropagation();mark();};
 card.querySelector('.exercise-done').onclick=()=>{mark();if(card.classList.contains('all-done'))card.open=false;};
 card.querySelector('.add-set').onclick=()=>{const rows=card.querySelectorAll('.set-row');if(rows.length>=12)return;const last=rows[rows.length-1];card.querySelector('.set-rows').insertAdjacentHTML('beforeend',rowHTML({weight:Number(last.querySelector('.weight').value),reps:Number(last.querySelector('.reps').value),done:false},rows.length));persist();updateAccess();};
 card.querySelector('.remove-set').onclick=()=>{const rows=card.querySelectorAll('.set-row');if(rows.length>1){rows[rows.length-1].remove();persist();}};
});
$('#currentWorkoutName').textContent=workout.name;$('#currentWorkoutMeta').textContent=historyView?'Занятие от '+date(draft.date):workout.exercises.length+' упражнений';
updateCompletion();updateAccess();renderDraftStatus();
}
function updateCompletion(){
 $$('.exercise').forEach(card=>{
  const rows=[...card.querySelectorAll('.set-row')],done=rows.every(r=>r.querySelector('.done-check').checked);
  card.classList.toggle('all-done',done);rows.forEach(row=>row.classList.toggle('done',row.querySelector('.done-check').checked));
  card.querySelector('.exercise-check').setAttribute('aria-pressed',String(done));
  card.querySelector('.exercise-check').setAttribute('aria-label',done?'Снять отметку выполнения':'Отметить упражнение выполненным');
  card.querySelector('.exercise-done').textContent=done?'Снять отметку':'Упражнение выполнено';
  const first=rows[0],weight=first.querySelector('.weight').value,reps=first.querySelector('.reps').value;
  const mixed=rows.some(r=>r.querySelector('.weight').value!==weight||r.querySelector('.reps').value!==reps);
  card.querySelector('.mixed-note').hidden=!mixed||uiOptions.showSets;
  const w=card.querySelector('.bulk-weight'),r=card.querySelector('.bulk-reps');
  if(document.activeElement!==w)w.value=weight;if(document.activeElement!==r)r.value=reps;
  card.querySelector('.exercise-current').textContent=Number(weight)>0||card.dataset.hasPrevious==='true'||done?mixed?'Разные веса и повторы':number(weight)+' кг × '+reps:'Введи вес и повторы';
 });
 const all=$$('.exercise');$('#continueWorkout').textContent=all.length&&all.every(e=>e.classList.contains('all-done'))?'Сохранить тренировку':'Продолжить';
}
function showView(name){$$('.view').forEach(v=>v.hidden=v.id!==name+'View');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'});}
function renderHistoryEntries(){const history=state.history.filter(s=>$('#historyFilter').value==='all'||s.workoutId===$('#historyFilter').value);$('#historyList').innerHTML=history.length?history.map(s=>{const w=state.workouts.find(w=>w.id===s.workoutId),count=s.exercises.filter(e=>doneSets(e).length).length;return '<details class="history-card"><summary><div><span class="history-date">'+escape(date(s.date))+'</span><h3>'+escape(w?.name||s.workoutId)+'</h3></div><span class="history-stat">'+count+' упражнений</span></summary><div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес, кг × повторы</th></tr></thead><tbody>'+s.exercises.map(e=>'<tr><td>'+escape(e.name)+'</td><td>'+historyResult(e)+'</td></tr>').join('')+'</tbody></table></div>'+(s.notes?'<p class="history-note">'+escape(s.notes)+'</p>':'')+(s.imported?'<p class="muted hint">'+escape(s.sourceNote||'Перенесено из дневника. Повторы по подходам восстановлены из общей записи.')+'</p>':'')+(state.editable?'<div class="history-actions"><button class="button secondary edit-entry" data-id="'+escape(s.id)+'">Исправить запись</button><button class="button subtle danger delete-entry" data-id="'+escape(s.id)+'">Удалить</button></div>':'')+'</details>';}).join(''):'<p class="empty">Здесь появятся сохранённые тренировки.</p>';$$('.edit-entry').forEach(b=>b.onclick=()=>startEdit(b.dataset.id));$$('.delete-entry').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));}
function startEdit(id){if(savingSession)return;if(dirty)persist();const s=state.history.find(s=>s.id===id);if(!s)return;editId=id;editVersion=s.version;editHistory=true;workoutId=s.workoutId;dirty=false;renderPicker();renderWorkout(s,undefined,'history');showView('workout');}
function renderHistory(){
  const toggle=$('#trashToggle');
  if(!state.editable)showTrash=false;
  if(toggle){toggle.hidden=!state.editable;toggle.textContent=showTrash?'К истории':'Корзина ('+(state.trash?.length||0)+')';}
  $('#historyFilter').closest('label').hidden=showTrash;
  if(!showTrash)return renderHistoryEntries();
  $('#historyList').innerHTML='<p class="muted">Удалённые занятия не учитываются в статистике. Их можно восстановить.</p>'+(state.trash?.length?state.trash.map(s=>'<article class="history-card"><div class="list-heading"><div><span class="history-date">'+escape(date(s.date))+'</span><h3>'+escape(state.workouts.find(w=>w.id===s.workoutId)?.name||s.workoutId)+'</h3></div><button class="button secondary restore-entry" data-id="'+escape(s.id)+'">Восстановить</button></div></article>').join(''):'<p class="empty">В корзине пусто.</p>');
  $$('.restore-entry').forEach(button=>button.onclick=async()=>{
    const entry=state.trash.find(s=>s.id===button.dataset.id);if(!entry)return;
    button.disabled=true;
    try{await request('/api/restore',{id:entry.id,version:entry.version});await refresh();toast('Тренировка восстановлена.');}
    catch(e){toast(e.message,true);button.disabled=false;}
  });
}
async function deleteEntry(id){const s=state.history.find(s=>s.id===id);if(!s||!confirm('Удалить тренировку от '+date(s.date)+'? Запись можно будет восстановить из корзины.'))return;try{await request('/api/delete',{id,version:s.version});await refresh();if(editId===id){editId=null;editVersion=null;dirty=false;renderWorkout();}toast('Запись удалена.');}catch(e){toast(e.message,true);}}
function historyResult(e){const rows=doneSets(e);if(!rows.length)return '—';const same=rows.every(s=>s.weight===rows[0].weight&&s.reps===rows[0].reps);return !uiOptions.showSets&&same?number(rows[0].weight)+' × '+rows[0].reps:rows.map(r=>number(r.weight)+' × '+r.reps).join(' · ');}
function openPin(){showSync();}
$('#accessButton').onclick=showSync;
$('#saveButton').onclick=async()=>{
 if(savingSession)return;if(!state.editable)return openPin();const value=collect();
 if(!value.date)return toast('Укажи дату.',true);
 if(!value.exercises.some(e=>e.setDetails.some(s=>s.done)))return toast('Отметь хотя бы один выполненный подход.',true);
 for(const input of $$('#exerciseList input[type=number]'))if(!input.checkValidity()){input.reportValidity();return;}
 persist();savingSession=true;updateAccess();renderDraftStatus();
 try{
  await request('/api/session',value);drafts.remove(value.id);editId=null;editVersion=null;editHistory=false;dirty=false;draftError='';await refresh();renderWorkout(undefined,undefined,'active');
  toast(githubStore.pending.length?'Сохранено на устройстве. Ожидает отправки на GitHub.':'Тренировка сохранена на GitHub.');
 }catch(e){toast(e.message,true);}finally{savingSession=false;updateAccess();renderDraftStatus();}
};
$('#cancelEdit').onclick=discardDraft;$('#discardDraft').onclick=discardDraft;
$('#sessionDate').oninput=persist;$('#notes').oninput=persist;$$('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#historyFilter').onchange=renderHistory;
$('#exportButton').textContent='Excel';
$('#exportButton').onclick=()=>{
 if(!state.history.length)return toast('В дневнике пока нет сохранённых тренировок.');
 try{
  const bytes=globalThis.TrainingExcel.buildWorkbook({workouts:state.workouts,history:state.history});
  const blob=new Blob([bytes],{type:globalThis.TrainingExcel.mimeType}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='trenirovki-'+today()+'.xlsx';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Файл Excel готов.');
 }catch(e){toast('Не удалось создать файл Excel. '+e.message,true);}
};
let timerLength=180,timerRemaining=180,timerEnd=0,timerInterval=null;function showTimer(){const seconds=timerEnd?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):timerRemaining;$('#timerDisplay').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(timerEnd&&seconds===0){clearInterval(timerInterval);timerEnd=0;timerRemaining=timerLength;$('#timerButton').textContent='Ещё раз';toast('Отдых закончен. Можно к следующему подходу.');navigator.vibrate?.([180,100,180]);}}
$('#timerButton').onclick=()=>{if(timerEnd){timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerEnd=0;clearInterval(timerInterval);$('#timerButton').textContent='Продолжить';}else{timerEnd=Date.now()+timerRemaining*1000;timerInterval=setInterval(showTimer,250);$('#timerButton').textContent='Пауза';}showTimer();};$('#timerReset').onclick=()=>{timerEnd=0;clearInterval(timerInterval);timerRemaining=timerLength;$('#timerButton').textContent='Старт';showTimer();};$$('[data-seconds]').forEach(b=>b.onclick=()=>{timerLength=Number(b.dataset.seconds);$$('[data-seconds]').forEach(x=>x.classList.toggle('selected',x===b));$('#timerReset').click();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)showTimer();});
window.addEventListener('pagehide',window.flushTrainingDraft);
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.flushTrainingDraft();});
setInterval(window.flushTrainingDraft,30000);
window.addEventListener('beforeunload',e=>{window.flushTrainingDraft();if(draftError&&dirty){e.preventDefault();e.returnValue='';}});
$('#headerDate').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
const trashToggle=document.createElement('button');
trashToggle.id='trashToggle';trashToggle.className='button secondary history-trash-toggle';trashToggle.hidden=true;
$('#historyList').before(trashToggle);
trashToggle.onclick=()=>{showTrash=!showTrash;renderHistory();};
(async()=>{try{await refresh();drafts.importLegacy(state.workouts.map(w=>w.id));drafts.reconcile(state.history);const active=drafts.active();if(active&&state.workouts.some(w=>w.id===active.session.workoutId))workoutId=active.session.workoutId;renderPicker();renderWorkout(undefined,active);$('#loadState').hidden=true;$('#content').hidden=false;if(githubStore.connected)updateFromAssistant();}catch(e){$('#loadState').textContent=e.message+' ';const b=document.createElement('button');b.textContent='Повторить';b.className='button secondary';b.onclick=()=>location.reload();$('#loadState').append(b);}})();

// Refresh externally recorded results without discarding anything being typed.
let remoteRefreshRunning=false;
async function updateFromAssistant(){
 if(document.hidden||savingSession||remoteRefreshRunning||!$('#content')||$('#content').hidden||$('#syncDialog').open||$('#programDialog')?.open)return;
 if(dirty)persist();
 remoteRefreshRunning=true;
 try{
  await githubStore.sync();
  await refresh();
  renderWorkoutForState();
 }catch{}finally{remoteRefreshRunning=false;renderSyncStatus();}
}
setInterval(updateFromAssistant,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateFromAssistant();});

function renderSyncStatus(){
 const status=githubStore.status,pending=githubStore.pendingCount;
 $('#syncMessage').textContent=status.message+(pending?' Ожидает отправки: '+pending+'.':'');
 $('#syncStatus').dataset.state=status.kind;
 const action=$('#syncAction');
 const label=!githubStore.connected?'Подключить дневник':status.kind==='conflict'?'Разобрать изменения':'Обновить дневник';
 action.setAttribute('aria-label',label);
 action.title=label+'. '+status.message;
 const syncing=action.disabled||status.kind==='syncing';
 action.classList.toggle('is-syncing',syncing);
 action.setAttribute('aria-busy',String(syncing));
 const feedback=$('#syncFeedback');
 feedback.hidden=!['offline','conflict'].includes(status.kind)&&!pending;
 feedback.textContent=status.message+(pending?' Ожидает отправки: '+pending+'.':'');
 if($('#settingsSyncSummary'))$('#settingsSyncSummary').textContent=githubStore.connected?status.message:'Подключи дневник, чтобы загрузить историю и записывать результаты.';
 if($('#syncDetails'))$('#syncDetails').textContent=(githubStore.lastSynced?'Последняя синхронизация: '+new Date(githubStore.lastSynced).toLocaleString('ru-RU')+'. ':'')+status.message+' '+(pending?'Ожидает отправки: '+pending+'.':'Все записи отправлены.');
}
function renderConflicts(){
 const host=$('#syncConflicts');host.replaceChildren();
 for(const conflict of githubStore.conflicts){
  const row=document.createElement('article');row.className='sync-conflict';
  const text=document.createElement('p');text.textContent=conflict.kind==='program'?'Упражнения в '+(state.workouts.find(w=>w.id===conflict.workoutId)?.name||'тренировке')+' изменены на двух устройствах. Выбери нужный список. Тренировки в истории останутся без изменений.':'Занятие от '+date(conflict.local.date)+' изменено на двух устройствах. Выбор моей версии заменит запись GitHub, включая статус корзины.';row.append(text);
  if(conflict.kind==='program'){const comparison=document.createElement('p');comparison.className='muted';comparison.textContent='На этом устройстве: '+conflict.local.map(e=>e.name).join(', ')+'. На GitHub: '+conflict.remote.map(e=>e.name).join(', ')+'.';row.append(comparison);}
  for(const [choice,label] of [['local','Применить мою версию'],['remote','Оставить версию GitHub']]){
   const b=document.createElement('button');b.className='button secondary';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await githubStore.resolve(conflict.id,choice);await refresh();renderWorkoutForState();renderConflicts();}catch(e){$('#syncError').textContent=e.message;}finally{b.disabled=false;renderSyncStatus();}};row.append(b);
  }host.append(row);
 }
}
function showSync(){
 $('#syncError').textContent='';$('#syncConnected').hidden=!githubStore.connected;$('#syncForm').hidden=githubStore.connected;
 $('#connectionCodeLabel').hidden=true;$('#connectionCode').value='';renderConflicts();renderSyncStatus();$('#syncDialog').showModal();
}
function renderWorkoutForState(){if(dirty){persist();renderWorkout(undefined,drafts.get(editId||draftId));return;}if(editId){const current=state.history.find(s=>s.id===editId);if(current){editVersion=current.version;renderWorkout(current);}else{editId=null;editVersion=null;renderWorkout();}}else renderWorkout();}
async function syncNow(){
 if(!githubStore.connected)return showSync();
 if($('#syncAction').disabled)return;
 $('#syncError').textContent='';$('#syncAction').disabled=true;renderSyncStatus();
 try{await githubStore.sync();await refresh();renderWorkoutForState();renderConflicts();}
 catch(e){$('#syncError').textContent=e.message;toast(e.message,true);}
 finally{$('#syncAction').disabled=false;renderSyncStatus();}
}
$('#syncAction').onclick=()=>githubStore.status.kind==='conflict'?showSync():syncNow();
$('#closeSync').onclick=()=>{$('#syncDialog').close();$('#githubToken').value='';$('#recoveryKey').value='';$('#pairingCode').value='';$('#connectionCode').value='';};
$('#syncDialog').addEventListener('close',()=>{$('#githubToken').value='';$('#recoveryKey').value='';$('#pairingCode').value='';$('#connectionCode').value='';});
$('#syncNow').onclick=syncNow;
$('#syncForm').onsubmit=async e=>{
 e.preventDefault();const button=$('#connectGitHub');button.disabled=true;$('#syncError').textContent='';
 try{await githubStore.connect({token:$('#githubToken').value,key:$('#recoveryKey').value,code:$('#pairingCode').value});$('#githubToken').value='';$('#recoveryKey').value='';$('#pairingCode').value='';await refresh();renderWorkoutForState();$('#syncConnected').hidden=false;$('#syncForm').hidden=true;toast('GitHub подключён. История загружена.');}
 catch(error){$('#syncError').textContent=error.message;}finally{button.disabled=false;renderSyncStatus();}
};
$('#copyConnection').onclick=async()=>{
 const code=githubStore.connectionCode();$('#connectionCodeLabel').hidden=false;$('#connectionCode').value=code;
 try{await navigator.clipboard.writeText(code);toast('Код скопирован. На другом устройстве вставь его в настройках синхронизации.');}catch{$('#connectionCode').focus();$('#connectionCode').select();}
};
$('#disconnectSync').onclick=async()=>{try{await githubStore.disconnect();await refresh();renderWorkoutForState();$('#syncDialog').close();}catch(e){$('#syncError').textContent=e.message;}};
window.addEventListener('online',updateFromAssistant);
window.addEventListener('storage',e=>{if(e.key==='my-training-github-v1'&&!dirty){try{githubStore.load();refresh().then(renderWorkoutForState);}catch{}}});

let assistantWindow=null;
$('#connectAssistant').onclick=()=>{
 if(!githubStore.connected)return toast('Сначала подключи дневник к GitHub.',true);
 assistantWindow=window.open('https://ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site/assistant-link','training-assistant-link');
 if(!assistantWindow)toast('Разреши открытие окна подключения. Код можно скопировать кнопкой «Код для другого устройства».',true);
};
window.addEventListener('message',event=>{
 if(event.origin!=='https://ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site'||event.source!==assistantWindow||event.data?.type!=='training-assistant-request'||!githubStore.connected)return;
 assistantWindow.postMessage({type:'training-assistant-credentials',code:githubStore.connectionCode()},event.origin);
});

function restoreNativeDrafts(raw){
 try{
  if(raw)drafts.merge(raw);drafts.reconcile(state.history);
  const active=drafts.active();
  if(active&&state.workouts.some(w=>w.id===active.session.workoutId)){workoutId=active.session.workoutId;editId=null;editHistory=false;dirty=false;renderPicker();renderWorkout(undefined,active);}
  renderDraftStatus();
 }catch(e){draftError='Не удалось восстановить резервный черновик. '+e.message;renderDraftStatus();}
}

$('#continueWorkout').onclick=()=>{
 if(!state.editable)return showView('settings');
 const first=$$('.exercise').find(e=>!e.classList.contains('all-done'));
 if(first){first.open=true;first.scrollIntoView({behavior:'smooth',block:'start'});}else $('#saveButton').click();
};
$('#showSetControls').onchange=()=>{if(dirty)persist();saveOptions({...uiOptions,showSets:$('#showSetControls').checked});};
$('#defaultSetCount').onchange=()=>{const field=$('#defaultSetCount');if(!field.checkValidity()||!field.value){field.reportValidity();return;}saveOptions({...uiOptions,defaultSets:Number(field.value)});if(!dirty&&!editId)renderWorkout();};
renderOptions();

