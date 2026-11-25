'use strict';
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
function latest(id){for(const s of state.history){const e=s.exercises.find(e=>e.exerciseId===id);if(e?.completed&&s.id!==editId)return{...e,date:s.date};}return null;}
let toastTimeout;function toast(text,error=false){$('#toast').textContent=text;$('#toast').classList.toggle('error-toast',error);$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').hidden=true,error?8000:4500);}
const githubStore=new TrainingGitHub.GitHubStore({workouts:window.TRAINING_PROGRAM||[]});
async function request(path,body){
 try{
  if(path==='/api/data')return githubStore.data();
  if(path==='/api/session')return await githubStore.mutate('save',body);
  if(path==='/api/delete')return await githubStore.mutate('delete',body);
  if(path==='/api/restore')return await githubStore.mutate('restore',body);
  throw new Error('Неизвестная операция.');
 }finally{renderSyncStatus();}
}
async function refresh(){state=await request('/api/data');updateAccess();renderPicker();renderHistory();renderProgress();}
function updateAccess(){
 $('#accessLabel').textContent=state.editable?'Синхронизация':'Подключить GitHub';
 $('#accessButton').classList.toggle('unlocked',state.editable);
 $('#viewBadge').textContent=state.editable?'GitHub подключён':'Подключи дневник';
 $('#saveButton').textContent=editId?'Сохранить изменения':'Сохранить тренировку';
 $('#saveButton').disabled=!state.editable;
 $('#saveHint').textContent=state.editable?'Сохраняется на GitHub. Без сети запись останется на устройстве до синхронизации.':'Подключи GitHub, чтобы загрузить историю и сохранять результаты.';
 $$('#exerciseList input, #exerciseList button, #sessionDate, #notes').forEach(e=>e.disabled=!state.editable);
 renderSyncStatus();
}
function renderPicker(){$('#workoutPicker').innerHTML=state.workouts.map(w=>{const last=state.history.find(s=>s.workoutId===w.id);return '<button class="workout-option '+(w.id===workoutId?'selected':'')+'" data-workout="'+escape(w.id)+'" aria-pressed="'+(w.id===workoutId)+'"><div class="picker-top"><strong>'+escape(w.name)+'</strong><span class="picker-mark">'+(w.id===workoutId?'●':'○')+'</span></div><p>'+escape(desc[w.id]||'')+'</p><span>'+(last?'Последняя: '+date(last.date).replace(' 2026 г.',''):'Пока без записей')+'</span></button>';}).join('');$$('[data-workout]').forEach(b=>b.onclick=()=>switchWorkout(b.dataset.workout));}
function key(){return'my-training-draft-v2-'+workoutId;}
function collect(){return{id:editId||draftId,version:editVersion,date:$('#sessionDate').value,workoutId,notes:$('#notes').value,exercises:$$('.exercise').map(card=>({exerciseId:card.dataset.exercise,setDetails:[...card.querySelectorAll('.set-row')].map(row=>({weight:Number(row.querySelector('.weight').value),reps:Number(row.querySelector('.reps').value),done:row.querySelector('.done-check').checked}))}))};}
function persist(){dirty=true;if(!editId){try{localStorage.setItem(key(),JSON.stringify(collect()));}catch{toast('Не удалось сохранить черновик на телефоне. Сохрани тренировку на сервере.',true);}}updateCompletion();}
function savedDraft(){try{return JSON.parse(localStorage.getItem(key())||'null');}catch{return null;}}
function switchWorkout(id){if(editId&&dirty&&!confirm('Выйти из редактирования без сохранения изменений?'))return;if(!editId&&dirty)persist();editId=null;editVersion=null;workoutId=id;dirty=false;renderPicker();renderWorkout();}
function rowHTML(s,i){return '<div class="set-row '+(s.done?'done':'')+'"><span class="set-number">'+(i+1)+'</span><input aria-label="Вес в подходе '+(i+1)+'" class="weight" type="number" inputmode="decimal" min="0" max="1000" step="0.25" value="'+escape(s.weight)+'"><input aria-label="Повторы в подходе '+(i+1)+'" class="reps" type="number" inputmode="numeric" min="1" max="200" step="1" value="'+escape(s.reps)+'"><input aria-label="Подход '+(i+1)+' выполнен" class="done-check" type="checkbox" '+(s.done?'checked':'')+'></div>';}
function renderWorkout(session){
if(!session&&!editId){
  const candidates=state.history.filter(s=>s.workoutId===workoutId&&s.date===today()&&s.exercises.some(e=>!e.completed));
  if(candidates.length===1){session=candidates[0];editId=session.id;editVersion=session.version;}
}
const workout=state.workouts.find(w=>w.id===workoutId);if(!workout)return;const draft=session||savedDraft();draftId=draft?.id||crypto.randomUUID();$('#sessionDate').value=draft?.date||today();$('#notes').value=draft?.notes||'';$('#workoutTitle').textContent='Упражнения';$('#workoutCount').textContent=workout.exercises.length+' в программе';$('#editBanner').hidden=!editId;$('#cancelEdit').hidden=!editId;$('#editBanner').textContent=editId?'Редактирование занятия от '+date(session.date):'';
$('#exerciseList').innerHTML=workout.exercises.map((ex,i)=>{const prev=latest(ex.id);const saved=draft?.exercises?.find(e=>e.exerciseId===ex.id);const rows=saved?sets(saved):sets(prev).map(s=>({...s,done:false}));const prevDone=prev?doneSets(prev):[];const previous=prevDone.length?number(prevDone[0].weight)+' кг · '+prevDone.map(s=>s.reps).join(' / ')+' повт.':'Нет прошлых записей';return '<article class="exercise" data-exercise="'+escape(ex.id)+'"><div class="exercise-head"><span class="exercise-number">'+String(i+1).padStart(2,'0')+'</span><div class="exercise-title"><h3>'+escape(ex.name)+'</h3><p class="muscles">'+escape(muscles[ex.id]||'')+'</p></div></div><div class="previous">В прошлый раз: <b>'+escape(previous)+'</b>'+(prev?' <span>· '+escape(date(prev.date).replace(' 2026 г.',''))+'</span>':'')+'</div><div class="set-head"><span>Подход</span><span>'+(ex.id==='assisted-pull-up'?'Помощь, кг':'Вес, кг')+'</span><span>Повторы</span><span>Готово</span></div><div class="set-rows">'+rows.map(rowHTML).join('')+'</div><div class="set-actions"><button type="button" class="text-button add-set">+ Подход</button><button type="button" class="text-button remove-set">Убрать последний</button></div>'+(hints[ex.id]?'<p class="muted hint">'+escape(hints[ex.id])+'</p>':'')+'</article>';}).join('');
$$('.exercise').forEach(card=>{card.addEventListener('input',persist);card.querySelector('.add-set').onclick=()=>{const rows=card.querySelectorAll('.set-row');if(rows.length>=12)return;const last=rows[rows.length-1];card.querySelector('.set-rows').insertAdjacentHTML('beforeend',rowHTML({weight:Number(last.querySelector('.weight').value),reps:Number(last.querySelector('.reps').value),done:false},rows.length));persist();updateAccess();};card.querySelector('.remove-set').onclick=()=>{const rows=card.querySelectorAll('.set-row');if(rows.length>1){rows[rows.length-1].remove();persist();}};});updateCompletion();updateAccess();}
function updateCompletion(){const rows=$$('.set-row'),done=rows.filter(r=>r.querySelector('.done-check').checked).length;$('#doneCount').textContent=done;$('#totalCount').textContent='/ '+rows.length;$('#completionBar').style.width=(rows.length?done/rows.length*100:0)+'%';$('#completionLabel').textContent=done===rows.length&&done?'Все подходы выполнены':done?'Осталось '+(rows.length-done)+' подходов':'Можно начинать';rows.forEach(r=>r.classList.toggle('done',r.querySelector('.done-check').checked));$$('.exercise').forEach(c=>c.classList.toggle('all-done',[...c.querySelectorAll('.done-check')].every(e=>e.checked)));}
function showView(name){$$('.view').forEach(v=>v.hidden=v.id!==name+'View');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='progress')renderProgress();if(name==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'});}
function renderHistoryEntries(){const history=state.history.filter(s=>$('#historyFilter').value==='all'||s.workoutId===$('#historyFilter').value);$('#historyList').innerHTML=history.length?history.map(s=>{const w=state.workouts.find(w=>w.id===s.workoutId),count=s.exercises.reduce((n,e)=>n+doneSets(e).length,0);return '<details class="history-card"><summary><div><span class="history-date">'+escape(date(s.date))+'</span><h3>'+escape(w?.name||s.workoutId)+'</h3></div><span class="history-stat">'+count+' подходов · +</span></summary><div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес, кг × повторы</th></tr></thead><tbody>'+s.exercises.map(e=>'<tr><td>'+escape(e.name)+'</td><td>'+doneSets(e).map(r=>number(r.weight)+' × '+r.reps).join(' · ')+'</td></tr>').join('')+'</tbody></table></div>'+(s.notes?'<p class="history-note">'+escape(s.notes)+'</p>':'')+(s.imported?'<p class="muted hint">'+escape(s.sourceNote||'Перенесено из дневника. Повторы по подходам восстановлены из общей записи.')+'</p>':'')+(state.editable?'<div class="history-actions"><button class="button secondary edit-entry" data-id="'+escape(s.id)+'">Исправить запись</button><button class="button subtle danger delete-entry" data-id="'+escape(s.id)+'">Удалить</button></div>':'')+'</details>';}).join(''):'<p class="empty">Здесь появятся сохранённые тренировки.</p>';$$('.edit-entry').forEach(b=>b.onclick=()=>startEdit(b.dataset.id));$$('.delete-entry').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));}
function startEdit(id){if(dirty&&editId&&!confirm('Отменить текущие изменения?'))return;const s=state.history.find(s=>s.id===id);if(!s)return;editId=id;editVersion=s.version;workoutId=s.workoutId;dirty=false;renderPicker();renderWorkout(s);showView('workout');}
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
function renderProgress(){const now=today(),month=now.slice(0,7),monday=new Date(now+'T12:00:00');monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const weekStart=new Date(monday.getTime()-monday.getTimezoneOffset()*60000).toISOString().slice(0,10);const weekly=state.history.filter(s=>s.date>=weekStart&&s.date<=now).length;$('#stats').innerHTML='<div class="stat-card"><strong>'+state.history.length+'</strong><span>занятий в дневнике</span></div><div class="stat-card"><strong>'+state.history.filter(s=>s.date.startsWith(month)).length+'</strong><span>в этом месяце</span></div><div class="stat-card"><strong>'+weekly+' <span style="display:inline;font-size:22px">/ 3</span></strong><span>на этой неделе</span></div>';const selected=$('#exerciseSelect').value;$('#exerciseSelect').innerHTML=state.workouts.flatMap(w=>w.exercises).map(e=>'<option value="'+escape(e.id)+'">'+escape(e.name)+'</option>').join('');if(selected)$('#exerciseSelect').value=selected;drawChart();}
function drawChart(){const ex=$('#exerciseSelect').value,metric=$('#metricSelect').value;const points=[...state.history].reverse().flatMap(s=>{const e=s.exercises.find(e=>e.exerciseId===ex),done=e?doneSets(e):[];if(!done.length)return[];return[{date:s.date,value:metric==='weight'?(ex==='assisted-pull-up'?Math.min(...done.map(s=>s.weight)):Math.max(...done.map(s=>s.weight))):metric==='reps'?done.reduce((n,s)=>n+s.reps,0):done.reduce((n,s)=>n+s.weight*s.reps,0),sets:done}];});$('#metricNote').textContent=ex==='assisted-pull-up'?'Гравитрон: снижение веса помощи означает рост нагрузки. Объём по противовесу не показывает реальную нагрузку.':metric==='weight'?'Максимальный вес среди выполненных подходов.':metric==='reps'?'Сумма повторений во всех выполненных подходах.':'Сумма веса × повторов. Для гантелей используется вес одной гантели.';if(!points.length){$('#chart').innerHTML='<p class="empty">Пока нет результатов по этому упражнению.</p>';$('#progressTable').innerHTML='';return;}const W=800,H=300,pad={l:64,r:28,t:30,b:42},max=Math.max(...points.map(p=>p.value),1)*1.12;const x=i=>points.length===1?W/2:pad.l+i*(W-pad.l-pad.r)/(points.length-1),y=v=>H-pad.b-v/max*(H-pad.t-pad.b);let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Динамика результатов; точные значения в таблице ниже"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cbf27b" stop-opacity=".18"/><stop offset="1" stop-color="#cbf27b" stop-opacity="0"/></linearGradient></defs>';for(let i=0;i<5;i++){const v=max*i/4,py=y(v);svg+='<line x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+py+'" y2="'+py+'" stroke="#303730"/><text x="'+(pad.l-13)+'" y="'+(py+5)+'" fill="#9aa597" text-anchor="end" font-size="14">'+number(v)+'</text>';}const path=points.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.value)).join(' ');svg+='<path d="'+path+' L'+x(points.length-1)+','+(H-pad.b)+' L'+x(0)+','+(H-pad.b)+' Z" fill="url(#fill)"/><path d="'+path+'" stroke="#cbf27b" stroke-width="3" fill="none"/>';points.forEach((p,i)=>{svg+='<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="5" fill="#cbf27b"><title>'+date(p.date)+': '+number(p.value)+'</title></circle>';if(points.length<7||i===0||i===points.length-1)svg+='<text x="'+x(i)+'" y="'+(H-12)+'" text-anchor="middle" fill="#9aa597" font-size="14">'+p.date.slice(8)+'.'+p.date.slice(5,7)+'</text>';});$('#chart').innerHTML=svg+'</svg>';$('#progressTable').innerHTML='<table><thead><tr><th>Дата</th><th>'+escape($('#metricSelect').selectedOptions[0].textContent)+'</th><th>Выполненные подходы</th></tr></thead><tbody>'+[...points].reverse().map(p=>'<tr><td>'+escape(date(p.date))+'</td><td>'+number(p.value)+'</td><td>'+p.sets.map(s=>number(s.weight)+' × '+s.reps).join(' · ')+'</td></tr>').join('')+'</tbody></table>';}
function openPin(){showSync();}
$('#accessButton').onclick=showSync;
$('#saveButton').onclick=async()=>{if(!state.editable)return openPin();const value=collect();if(!value.date)return toast('Укажи дату.',true);if(!value.exercises.some(e=>e.setDetails.some(s=>s.done)))return toast('Отметь хотя бы один выполненный подход.',true);for(const input of $$('#exerciseList input[type=number]'))if(!input.checkValidity()){input.reportValidity();return;}$('#saveButton').disabled=true;try{await request('/api/session',value);if(!editId)localStorage.removeItem(key());editId=null;editVersion=null;dirty=false;await refresh();renderWorkout();toast(githubStore.pending.length?'Сохранено на устройстве. Ожидает отправки на GitHub.':'Тренировка сохранена на GitHub.');}catch(e){toast(e.message,true);}finally{updateAccess();}};
$('#cancelEdit').onclick=()=>{if(dirty&&!confirm('Отменить изменения этой записи?'))return;editId=null;editVersion=null;dirty=false;renderWorkout();};
$('#sessionDate').oninput=persist;$('#notes').oninput=persist;$$('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#historyFilter').onchange=renderHistory;$('#exerciseSelect').onchange=drawChart;$('#metricSelect').onchange=drawChart;
$('#exportButton').onclick=()=>{const blob=new Blob([JSON.stringify({schemaVersion:2,workouts:state.workouts,history:state.history},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='training-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let timerLength=180,timerRemaining=180,timerEnd=0,timerInterval=null;function showTimer(){const seconds=timerEnd?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):timerRemaining;$('#timerDisplay').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(timerEnd&&seconds===0){clearInterval(timerInterval);timerEnd=0;timerRemaining=timerLength;$('#timerButton').textContent='Ещё раз';toast('Отдых закончен. Можно к следующему подходу.');navigator.vibrate?.([180,100,180]);}}
$('#timerButton').onclick=()=>{if(timerEnd){timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerEnd=0;clearInterval(timerInterval);$('#timerButton').textContent='Продолжить';}else{timerEnd=Date.now()+timerRemaining*1000;timerInterval=setInterval(showTimer,250);$('#timerButton').textContent='Пауза';}showTimer();};$('#timerReset').onclick=()=>{timerEnd=0;clearInterval(timerInterval);timerRemaining=timerLength;$('#timerButton').textContent='Запустить таймер';showTimer();};$$('[data-seconds]').forEach(b=>b.onclick=()=>{timerLength=Number(b.dataset.seconds);$$('[data-seconds]').forEach(x=>x.classList.toggle('selected',x===b));$('#timerReset').click();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)showTimer();});
window.addEventListener('beforeunload',e=>{if(editId&&dirty){e.preventDefault();e.returnValue='';}});
$('#headerDate').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'}).toUpperCase();
const trashToggle=document.createElement('button');
trashToggle.id='trashToggle';trashToggle.className='button secondary history-trash-toggle';trashToggle.hidden=true;
$('#historyList').before(trashToggle);
trashToggle.onclick=()=>{showTrash=!showTrash;renderHistory();};
(async()=>{try{await refresh();renderWorkout();$('#loadState').hidden=true;$('#content').hidden=false;if(githubStore.connected)updateFromAssistant();}catch(e){$('#loadState').textContent=e.message+' ';const b=document.createElement('button');b.textContent='Повторить';b.className='button secondary';b.onclick=()=>location.reload();$('#loadState').append(b);}})();

// Refresh externally recorded results without discarding anything being typed.
let remoteRefreshRunning=false;
async function updateFromAssistant(){
 if(document.hidden||dirty||remoteRefreshRunning||!$('#content')||$('#content').hidden||$('#syncDialog').open)return;
 remoteRefreshRunning=true;
 try{
  await githubStore.sync();
  await refresh();
  if(editId){const current=state.history.find(s=>s.id===editId);if(current){editVersion=current.version;renderWorkout(current);}else{editId=null;editVersion=null;renderWorkout();}}
  else renderWorkout();
 }catch{}finally{remoteRefreshRunning=false;renderSyncStatus();}
}
setInterval(updateFromAssistant,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateFromAssistant();});

function renderSyncStatus(){
 const status=githubStore.status,pending=githubStore.pending.length;
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
 if($('#syncDetails'))$('#syncDetails').textContent=(githubStore.lastSynced?'Последняя синхронизация: '+new Date(githubStore.lastSynced).toLocaleString('ru-RU')+'. ':'')+status.message+' '+(pending?'Ожидает отправки: '+pending+'.':'Все записи отправлены.');
}
function renderConflicts(){
 const host=$('#syncConflicts');host.replaceChildren();
 for(const conflict of githubStore.conflicts){
  const row=document.createElement('article');row.className='sync-conflict';
  const text=document.createElement('p');text.textContent='Занятие от '+date(conflict.local.date)+' изменено на двух устройствах. Выбор моей версии заменит запись GitHub, включая статус корзины.';row.append(text);
  for(const [choice,label] of [['local','Применить мою версию'],['remote','Оставить версию GitHub']]){
   const b=document.createElement('button');b.className='button secondary';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await githubStore.resolve(conflict.id,choice);await refresh();renderWorkoutForState();renderConflicts();}catch(e){$('#syncError').textContent=e.message;}finally{b.disabled=false;renderSyncStatus();}};row.append(b);
  }host.append(row);
 }
}
function showSync(){
 $('#syncError').textContent='';$('#syncConnected').hidden=!githubStore.connected;$('#syncForm').hidden=githubStore.connected;
 $('#connectionCodeLabel').hidden=true;$('#connectionCode').value='';renderConflicts();renderSyncStatus();$('#syncDialog').showModal();
}
function renderWorkoutForState(){if(dirty)return;if(editId){const current=state.history.find(s=>s.id===editId);if(current){editVersion=current.version;renderWorkout(current);}else{editId=null;editVersion=null;renderWorkout();}}else renderWorkout();}
async function syncNow(){
 if(!githubStore.connected)return showSync();
 if($('#syncAction').disabled)return;
 $('#syncError').textContent='';$('#syncAction').disabled=true;renderSyncStatus();
 try{await githubStore.sync();await refresh();renderWorkoutForState();renderConflicts();}
 catch(e){$('#syncError').textContent=e.message;toast(e.message,true);}
 finally{$('#syncAction').disabled=false;renderSyncStatus();}
}
$('#syncSettings').onclick=showSync;$('#syncAction').onclick=()=>githubStore.status.kind==='conflict'?showSync():syncNow();
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
