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
  const input=document.createElement('input');input.value=exercise.name;input.required=true;input.maxLength=120;
  input.placeholder='Например, жим гантелей';input.autocomplete='off';input.setAttribute('aria-label','Название упражнения '+(index+1));
  input.oninput=()=>{programDraft[index].name=input.value;};label.append(input);row.append(label);
  const actions=document.createElement('div');actions.className='program-row-actions';
  const replace=document.createElement('button');replace.type='button';replace.className='text-button';replace.textContent='Заменить';replace.setAttribute('aria-label','Заменить упражнение '+(index+1));
  replace.onclick=()=>{programDraft[index]={id:'ex-'+crypto.randomUUID(),name:''};renderProgramRows();$('#programRows').children[index].querySelector('input').focus();};
  const remove=document.createElement('button');remove.type='button';remove.className='text-button danger';remove.textContent='Убрать';remove.setAttribute('aria-label','Убрать упражнение '+(index+1));
  remove.disabled=programDraft.length===1;
  remove.onclick=()=>{programDraft.splice(index,1);renderProgramRows();};
  actions.append(replace,remove);row.append(actions);host.append(row);
 });
 $('#addExercise').disabled=programDraft.length>=40;
}
$('#editProgram').onclick=()=>{
 if(!state.editable)return showSync();
 const workout=state.workouts.find(w=>w.id===workoutId);if(!workout)return;
 programWorkoutId=workout.id;programBase=workout.exercises.map(e=>({id:e.id,name:e.name}));programDraft=structuredClone(programBase);
 $('#programTitle').textContent=workout.name;$('#programError').textContent='';renderProgramRows();$('#programDialog').showModal();
};
$('#addExercise').onclick=()=>{
 if(programDraft.length>=40)return;
 programDraft.push({id:'ex-'+crypto.randomUUID(),name:''});renderProgramRows();
 $('#programRows').lastElementChild.querySelector('input').focus();
};
$('#closeProgram').onclick=closeProgram;$('#cancelProgram').onclick=closeProgram;
$('#programDialog').addEventListener('cancel',event=>{event.preventDefault();closeProgram();});
$('#programForm').onsubmit=async event=>{
 event.preventDefault();if(programSaving||!$('#programForm').reportValidity())return;
 const draft=programDraft.map(e=>({...e,name:e.name.trim()}));
 if(draft.some(e=>!e.name)){$('#programError').textContent='Укажи название каждого упражнения.';return;}
 programSaving=true;$('#programError').textContent='';
 $$('#programForm button, #programForm input, #closeProgram').forEach(e=>e.disabled=true);
 try{
  const result=await githubStore.saveProgram(programWorkoutId,draft,programBase);
  await refresh();renderWorkoutForState();$('#programDialog').close();
  toast(githubStore.status.kind==='conflict'?'Программа сохранена на устройстве. Выбери версию в синхронизации.':result.synced?'Программа сохранена и синхронизирована.':'Программа сохранена на устройстве. Синхронизируется после восстановления связи.');
 }catch(error){$('#programError').textContent=error.message;}
 finally{
  programSaving=false;$$('#programForm button, #programForm input, #closeProgram').forEach(e=>e.disabled=false);
  if($('#programDialog').open)renderProgramRows();renderSyncStatus();
 }
};
