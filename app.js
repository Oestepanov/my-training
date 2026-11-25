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
const API_ORIGIN=window.TRAINING_API_ORIGIN||'';
const DEVICE_KEY='my-training-cloudflare-device-v1';
let accessToken='';
try{
  const saved=JSON.parse(localStorage.getItem(DEVICE_KEY)||sessionStorage.getItem(DEVICE_KEY)||'null');
  if(saved?.expires>Date.now()&&/^[a-f0-9]{64}$/.test(saved.token))accessToken=saved.token;
}catch{}
function forgetDevice(){accessToken='';try{localStorage.removeItem(DEVICE_KEY);sessionStorage.removeItem(DEVICE_KEY);}catch{}}
function rememberDevice(login,permanent){
  forgetDevice();accessToken=login.deviceToken;
  try{(permanent?localStorage:sessionStorage).setItem(DEVICE_KEY,JSON.stringify({token:login.deviceToken,expires:login.expires}));}
  catch{toast('Браузер не разрешил запомнить устройство. Доступ сохранится до закрытия страницы.',true);}
}
async function request(path,body){
  let response;
  const headers={...(body===undefined?{}:{'Content-Type':'application/json'}),...(accessToken?{Authorization:'Bearer '+accessToken}:{})};
  try{response=await fetch(API_ORIGIN+path,{method:body===undefined?'GET':'POST',headers,credentials:'omit',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});}
  catch{throw new Error('Нет соединения с сервером. Черновик новой тренировки остаётся на этом устройстве.');}
  let value;try{value=await response.json();}catch{throw new Error('Сервер временно недоступен. Попробуй ещё раз.');}
  if(!response.ok){if(response.status===401){forgetDevice();state.editable=false;updateAccess();}throw new Error(value.error||'Не удалось выполнить запрос.');}
  if(path==='/api/data'&&!value.editable&&accessToken)forgetDevice();
  return value;
}
async function refresh(){state=await request('/api/data');updateAccess();renderPicker();renderHistory();renderProgress();}
function updateAccess(){$('#accessLabel').textContent=state.editable?'Выйти':'Ввести PIN';$('#accessButton').classList.toggle('unlocked',state.editable);$('#viewBadge').textContent=state.editable?'Редактирование открыто':'Режим просмотра';$('#changePin').hidden=!state.editable;$('#devicesButton').hidden=!state.editable;$('#saveButton').textContent=editId?'Сохранить изменения':'Сохранить тренировку';$('#saveButton').disabled=!state.editable;$('#saveHint').textContent=state.editable?'Сохраняется на сервере и доступно с любого устройства.':'Для записи результатов введи PIN.';$$('#exerciseList input, #exerciseList button, #sessionDate, #notes').forEach(e=>e.disabled=!state.editable);}
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
function openPin(mode='unlock'){pinMode=mode;$('#pinTitle').textContent=mode==='change'?'Новый PIN':'Введи PIN';$('#pinDescription').textContent=mode==='change'?'После смены кода редактирование на всех устройствах закроется.':'Четыре цифры, чтобы записывать результаты.';$('#pinSubmit').textContent=mode==='change'?'Сменить PIN':'Открыть редактирование';$('#pinConfirmLabel').hidden=mode!=='change';$('#deviceOptions').hidden=mode==='change';$('#pinConfirm').required=mode==='change';$('#pinInput').value='';$('#pinConfirm').value='';$('#pinError').textContent='';$('#pinDialog').showModal();$('#pinInput').focus();}
$('#pinForm').onsubmit=async e=>{e.preventDefault();const button=$('#pinSubmit');button.disabled=true;$('#pinError').textContent='';try{if(pinMode==='change'&&$('#pinInput').value!==$('#pinConfirm').value)throw new Error('Коды не совпадают.');const remember=$('#rememberDevice').checked;const login=await request(pinMode==='change'?'/api/pin':'/api/unlock',{pin:$('#pinInput').value,remember,deviceName:$('#deviceName').value});if(pinMode==='change')forgetDevice();else rememberDevice(login,remember);$('#pinDialog').close();$('#pinInput').value='';$('#pinConfirm').value='';await refresh();if(!dirty&&!editId)renderWorkout();else updateAccess();toast(pinMode==='change'?'PIN изменён. Введи новый код для записи.':remember?'Устройство подтверждено на 90 дней.':'Доступ открыт на 12 часов в этом браузере.');}catch(e){$('#pinError').textContent=e.message;}finally{button.disabled=false;}};
$('#accessButton').onclick=async()=>{if(!state.editable)return openPin();if(dirty)persist();try{await request('/api/lock',{});forgetDevice();state.editable=false;updateAccess();renderHistory();toast('Редактирование закрыто.');}catch(e){toast(e.message,true);}};
$('.dialog-close').onclick=()=>$('#pinDialog').close();$('#changePin').onclick=()=>openPin('change');
$('#saveButton').onclick=async()=>{if(!state.editable)return openPin();const value=collect();if(!value.date)return toast('Укажи дату.',true);if(!value.exercises.some(e=>e.setDetails.some(s=>s.done)))return toast('Отметь хотя бы один выполненный подход.',true);for(const input of $$('#exerciseList input[type=number]'))if(!input.checkValidity()){input.reportValidity();return;}$('#saveButton').disabled=true;try{await request('/api/session',value);if(!editId)localStorage.removeItem(key());editId=null;editVersion=null;dirty=false;await refresh();renderWorkout();toast('Тренировка сохранена. Хорошая работа!');}catch(e){toast(e.message,true);}finally{updateAccess();}};
$('#cancelEdit').onclick=()=>{if(dirty&&!confirm('Отменить изменения этой записи?'))return;editId=null;editVersion=null;dirty=false;renderWorkout();};
$('#sessionDate').oninput=persist;$('#notes').oninput=persist;$$('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#historyFilter').onchange=renderHistory;$('#exerciseSelect').onchange=drawChart;$('#metricSelect').onchange=drawChart;
$('#exportButton').onclick=()=>{const blob=new Blob([JSON.stringify({schemaVersion:2,workouts:state.workouts,history:state.history},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='training-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let timerLength=180,timerRemaining=180,timerEnd=0,timerInterval=null;function showTimer(){const seconds=timerEnd?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):timerRemaining;$('#timerDisplay').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(timerEnd&&seconds===0){clearInterval(timerInterval);timerEnd=0;timerRemaining=timerLength;$('#timerButton').textContent='Ещё раз';toast('Отдых закончен. Можно к следующему подходу.');navigator.vibrate?.([180,100,180]);}}
$('#timerButton').onclick=()=>{if(timerEnd){timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerEnd=0;clearInterval(timerInterval);$('#timerButton').textContent='Продолжить';}else{timerEnd=Date.now()+timerRemaining*1000;timerInterval=setInterval(showTimer,250);$('#timerButton').textContent='Пауза';}showTimer();};$('#timerReset').onclick=()=>{timerEnd=0;clearInterval(timerInterval);timerRemaining=timerLength;$('#timerButton').textContent='Запустить таймер';showTimer();};$$('[data-seconds]').forEach(b=>b.onclick=()=>{timerLength=Number(b.dataset.seconds);$$('[data-seconds]').forEach(x=>x.classList.toggle('selected',x===b));$('#timerReset').click();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)showTimer();});
window.addEventListener('beforeunload',e=>{if(editId&&dirty){e.preventDefault();e.returnValue='';}});
const ua=navigator.userAgent;$('#deviceName').value=/Android/i.test(ua)?'Телефон Android':/iPhone|iPad/i.test(ua)?'iPhone / iPad':/Windows/i.test(ua)?'Компьютер Windows':/Macintosh/i.test(ua)?'Mac':'Компьютер / браузер';
$('#headerDate').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'}).toUpperCase();
const trashToggle=document.createElement('button');
trashToggle.id='trashToggle';trashToggle.className='button secondary history-trash-toggle';trashToggle.hidden=true;
$('#historyList').before(trashToggle);
trashToggle.onclick=()=>{showTrash=!showTrash;renderHistory();};
$('#devicesButton').onclick=async()=>{
  $('#devicesDialog').showModal();
  await loadDevices();
};
$('#closeDevices').onclick=()=>$('#devicesDialog').close();
async function loadDevices(){
  $('#devicesList').textContent='Загружаю устройства…';
  try{
    const {devices}=await request('/api/devices');
    $('#devicesList').innerHTML=devices.map(device=>'<article class="device-card"><div><strong>'+escape(device.label)+(device.current?' <span class="device-current">Это устройство</span>':'')+'</strong><p class="muted">Доступ до '+escape(new Date(device.expires).toLocaleDateString('ru-RU'))+'</p></div><button class="button subtle revoke-device" data-id="'+escape(device.id)+'">Отключить</button></article>').join('')||'<p class="muted">Нет подтверждённых устройств.</p>';
    $$('.revoke-device').forEach(button=>button.onclick=async()=>{
      const device=devices.find(d=>d.id===button.dataset.id);button.disabled=true;
      try{
        await request('/api/revoke-device',{id:device.id});
        if(device.current){forgetDevice();$('#devicesDialog').close();await refresh();updateAccess();}
        else await loadDevices();
        toast('Устройство отключено. Для записи снова потребуется PIN.');
      }catch(e){toast(e.message,true);button.disabled=false;}
    });
  }catch(e){$('#devicesList').textContent=e.message;}
}
(async()=>{try{await refresh();renderWorkout();$('#loadState').hidden=true;$('#content').hidden=false;}catch(e){$('#loadState').textContent=e.message+' ';const b=document.createElement('button');b.textContent='Повторить';b.className='button secondary';b.onclick=()=>location.reload();$('#loadState').append(b);}})();

// Refresh externally recorded results without discarding anything being typed.
let remoteRefreshRunning=false;
async function updateFromAssistant(){
 if(document.hidden||dirty||remoteRefreshRunning||!$('#content')||$('#content').hidden||$('#pinDialog').open||$('#devicesDialog').open)return;
 remoteRefreshRunning=true;
 try{
  await refresh();
  if(editId){const current=state.history.find(s=>s.id===editId);if(current){editVersion=current.version;renderWorkout(current);}else{editId=null;editVersion=null;renderWorkout();}}
  else renderWorkout();
 }catch{}finally{remoteRefreshRunning=false;}
}
setInterval(updateFromAssistant,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateFromAssistant();});
