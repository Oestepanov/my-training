'use strict';
let programDraft=null,programBase=null,programWorkoutId=null,programSaving=false;
function programChanged(){return JSON.stringify(programDraft)!==JSON.stringify(programBase);}
function closeProgram(){
 if(programSaving)return;
 if(programChanged()&&!confirm('Закрыть редактор без сохранения изменений программы?'))return;
 $('#programDialog').close();
}
function renderProgramRows(){
 const host=$('#programRows');host.replaceChildren();
 programDraft.forEach((exercise,index)=>{
  const row=document.createElement('div');row.className='program-row';row.dataset.programExercise=exercise.id;
  const label=document.createElement('label');label.textContent='Упражнение '+(index+1);
  const select=document.createElement('select');select.required=true;select.setAttribute('aria-label','Выбор упражнения '+(index+1));
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Выбери упражнение';placeholder.disabled=true;select.append(placeholder);
  for(const known of TrainingGitHub.catalog){
   const option=document.createElement('option');option.value=known.id;option.textContent=known.name;
   option.disabled=programDraft.some((e,i)=>i!==index&&e.id===known.id);select.append(option);
  }
  select.value=TrainingGitHub.exerciseInfo(exercise)?.id||'';
  select.onchange=()=>{const known=TrainingGitHub.exerciseInfo(select.value);programDraft[index]={id:known.id,name:known.name};renderProgramRows();$('#programRows').children[index].querySelector('select').focus();};
  label.append(select);row.append(label);
  const known=TrainingGitHub.exerciseInfo(exercise);
  if(known){
   const muscles=document.createElement('p');muscles.className='program-muscles';muscles.textContent=known.muscles;
   const description=document.createElement('p');description.className='program-description muted';description.textContent=known.description;
   const previous=document.createElement('p');previous.className='program-previous';
   const result=latest(known.id),performed=result?doneSets(result):[];
   previous.textContent=performed.length?'Последний результат: '+performed.map(s=>number(s.weight)+' кг × '+s.reps).join(' · ')+' — '+date(result.date):'Прошлых результатов пока нет';
   row.append(muscles,description,previous);
  }
  const actions=document.createElement('div');actions.className='program-row-actions';
  const remove=document.createElement('button');remove.type='button';remove.className='text-button danger';remove.textContent='Убрать из тренировки';remove.setAttribute('aria-label','Убрать упражнение '+(index+1));
  remove.disabled=programDraft.length===1;remove.onclick=()=>{programDraft.splice(index,1);renderProgramRows();};
  actions.append(remove);row.append(actions);host.append(row);
 });
 $('#addExercise').disabled=programDraft.length>=TrainingGitHub.catalog.length;
}
$('#editProgram').onclick=()=>{
 if(!state.editable)return showSync();
 const workout=state.workouts.find(w=>w.id===workoutId);if(!workout)return;
 programWorkoutId=workout.id;programBase=workout.exercises.map(e=>({id:e.id,name:e.name}));programDraft=structuredClone(programBase);
 $('#programTitle').textContent=workout.name;$('#programError').textContent='';renderProgramRows();$('#programDialog').showModal();
};
$('#addExercise').onclick=()=>{
 if(programDraft.length>=TrainingGitHub.catalog.length)return;
 programDraft.push({id:'',name:''});renderProgramRows();
 $('#programRows').lastElementChild.querySelector('select').focus();
};
$('#closeProgram').onclick=closeProgram;$('#cancelProgram').onclick=closeProgram;
$('#programDialog').addEventListener('cancel',event=>{event.preventDefault();closeProgram();});
$('#programForm').onsubmit=async event=>{
 event.preventDefault();if(programSaving||!$('#programForm').reportValidity())return;
 const draft=programDraft.map(e=>({id:e.id,name:e.name}));
 programSaving=true;$('#programError').textContent='';
 $$('#programForm button, #programForm select, #closeProgram').forEach(e=>e.disabled=true);
 try{
  const result=await githubStore.saveProgram(programWorkoutId,draft,programBase);
  await refresh();renderWorkoutForState();$('#programDialog').close();
  toast(githubStore.status.kind==='conflict'?'Программа сохранена на устройстве. Выбери версию в синхронизации.':result.synced?'Программа сохранена и синхронизирована.':'Программа сохранена на устройстве. Синхронизируется после восстановления связи.');
 }catch(error){$('#programError').textContent=error.message;}
 finally{
  programSaving=false;$$('#programForm button, #programForm select, #closeProgram').forEach(e=>e.disabled=false);
  if($('#programDialog').open)renderProgramRows();renderSyncStatus();
 }
};
