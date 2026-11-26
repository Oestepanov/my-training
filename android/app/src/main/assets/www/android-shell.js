/* Android adapters for the same encrypted diary used by the website. */
(function(){
 'use strict';
 const bridge=window.TrainingAndroid;if(!bridge)return;
 const post=data=>bridge.postMessage(JSON.stringify(data));
 const exportButton=document.querySelector('#exportButton');
 exportButton.onclick=()=>{
  if(!state.history.length)return toast('В дневнике пока нет сохранённых тренировок.');
  try{
   const bytes=globalThis.TrainingExcel.buildWorkbook({workouts:state.workouts,history:state.history});
   post({type:'export',filename:'trenirovki-'+today()+'.xlsx',base64:TrainingGitHub.bytesTo64(bytes)});
  }catch(e){toast('Не удалось создать файл Excel. '+e.message,true);}
 };
 const copyCode=()=>{
  const code=githubStore.connectionCode();
  document.querySelector('#connectionCodeLabel').hidden=false;
  document.querySelector('#connectionCode').value=code;
  post({type:'copy',text:code});
 };
 document.querySelector('#copyConnection').onclick=()=>{try{copyCode();}catch(e){toast(e.message,true);}};
 document.querySelector('#connectAssistant').onclick=()=>{
  try{
   copyCode();
   post({type:'openExternal',url:'https://ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site/assistant-link'});
   toast('Код скопирован. Вставь его на странице подключения ассистента.');
  }catch(e){toast(e.message,true);}
 };
 const start=document.querySelector('#timerButton'),reset=document.querySelector('#timerReset');
 const webStart=start.onclick,webReset=reset.onclick;
 start.onclick=()=>{webStart();post(timerEnd?{type:'startTimer',deadline:timerEnd}:{type:'cancelTimer'});};
 reset.onclick=()=>{webReset();post({type:'cancelTimer'});};
 window.TrainingAndroidApp={
  restoreTimer(deadline){
   if(deadline>0){
    clearInterval(timerInterval);timerEnd=deadline;
    timerRemaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    start.textContent='Пауза';timerInterval=setInterval(showTimer,250);showTimer();
   }else if(timerEnd){showTimer();}
  }
 };
 post({type:'ready'});
})();
