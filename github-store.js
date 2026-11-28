/* GitHub is the only remote service. Credentials never enter repository content. */
(function(root){
 'use strict';
 const FORMAT='my-training-encrypted-v1', STORAGE='my-training-github-v1';
 const REPO='Oestepanov/my-training', BRANCH='training-data', FILE='diary.enc.json';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const catalog=[
  {id:'bench-press',name:'Жим штанги лёжа',muscles:'Грудь · трицепс · передние дельты',description:'Горизонтальный жим штанги на скамье.',hint:'Общий вес штанги вместе с грифом.'},
  {id:'leg-press',name:'Жим ногами',muscles:'Квадрицепс · ягодицы',description:'Разгибание ног в тренажёре с платформой.',hint:'Указывай вес на тренажёре одинаковым способом каждый раз.'},
  {id:'seated-hammer-curl',name:'Молотки сидя',muscles:'Бицепс · плечевая мышца · предплечья',description:'Сгибание рук с гантелями нейтральным хватом сидя.',hint:'Вес одной гантели.'},
  {id:'lying-leg-curl',name:'Сгибание ног лёжа',muscles:'Задняя поверхность бедра',description:'Сгибание ног лёжа в тренажёре.'},
  {id:'barbell-wrist-curl',name:'Сгибание кистей со штангой',muscles:'Сгибатели предплечья',description:'Сгибание кистей со штангой с опорой для предплечий.'},
  {id:'incline-bench-press',name:'Жим штанги на наклонной',muscles:'Верх груди · трицепс · передние дельты',description:'Жим штанги на наклонной скамье.',hint:'Общий вес штанги вместе с грифом.'},
  {id:'lat-pulldown',name:'Вертикальная тяга',muscles:'Широчайшие мышцы спины · бицепс',description:'Тяга верхнего блока к груди.'},
  {id:'seated-cable-row',name:'Нижняя тяга сидя',muscles:'Широчайшие мышцы спины · средняя часть спины · бицепс',description:'Горизонтальная тяга рукоятки нижнего блока к поясу сидя.'},
  {id:'lateral-raise',name:'Махи в стороны',muscles:'Средние дельты',description:'Подъём гантелей через стороны.',hint:'Вес одной гантели.'},
  {id:'reverse-pec-deck',name:'Обратная бабочка',muscles:'Задние дельты · верх спины',description:'Разведение рук в тренажёре «Бабочка» лицом к спинке.'},
  {id:'assisted-pull-up',name:'Гравитрон (помощь)',muscles:'Грудь / спина · руки — по варианту',description:'Упражнение в гравитроне с противовесом. Группы мышц зависят от варианта: подтягивания или отжимания.',hint:'Записывай вес помощи: меньше помощи — выше нагрузка.'},
  {id:'dumbbell-curl',name:'Сгибание рук с гантелями',muscles:'Бицепс · плечевая мышца',description:'Сгибание рук с гантелями на бицепс.',hint:'Вес одной гантели.'},
  {id:'pec-deck',name:'Бабочка',muscles:'Грудные мышцы',description:'Сведение рук перед собой в тренажёре «Бабочка».'},
  {id:'triceps-pushdown',name:'Разгибание рук на блоке',muscles:'Трицепс',description:'Разгибание рук вниз на верхнем блоке.'},
  {id:'pullover',name:'Пуловер',muscles:'Грудь · широчайшие мышцы спины',description:'Опускание и подъём гантели за голову лёжа на скамье.',hint:'Вес одной гантели.'}
 ];
 const catalogById=new Map(catalog.map(e=>[e.id,e]));
 const normalizeName=s=>String(s||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const catalogByName=new Map(catalog.map(e=>[normalizeName(e.name),e]));
 for(const [alias,id] of [['Пулловер','pullover'],['Гравитрон','assisted-pull-up'],['Жим штанги на наклонной скамье','incline-bench-press']])catalogByName.set(normalizeName(alias),catalogById.get(id));
 function exerciseInfo(exercise){
  if(typeof exercise==='string')return catalogById.get(exercise)||null;
  return catalogById.get(exercise.id||exercise.exerciseId)||catalogByName.get(normalizeName(exercise.name))||null;
 }
 function exerciseKey(exercise){return exerciseInfo(exercise)?.id||(typeof exercise==='string'?exercise:exercise.id||exercise.exerciseId);}
 function normalizeExercises(items){
  const ids=new Set();return items.map(e=>{const known=exerciseInfo(e);return known?{id:known.id,name:known.name}:clone(e);}).filter(e=>{if(ids.has(e.id))return false;ids.add(e.id);return true;});
 }
 function normalizePrograms(doc){
  for(const w of doc.workouts){w.exercises=normalizeExercises(w.exercises);if(w.archivedExercises)w.archivedExercises=normalizeExercises(w.archivedExercises).filter(e=>!w.exercises.some(x=>x.id===e.id));}
  return doc;
 }
 const sameExercises=(a,b)=>JSON.stringify(a.map(e=>({id:e.id,name:e.name})))===JSON.stringify(b.map(e=>({id:e.id,name:e.name})));
 function validateExercises(items){
  if(!Array.isArray(items)||items.length<1||items.length>catalog.length)throw new Error('Выбери хотя бы одно упражнение из списка.');
  const ids=new Set();return items.map(e=>{
   const known=catalogById.get(e.id);
   if(!known||ids.has(e.id)||(e.name!=null&&e.name!==known.name))throw new Error('Выбирай упражнения из списка. Одно упражнение можно добавить в тренировку один раз.');
   ids.add(e.id);return {id:known.id,name:known.name};
  });
 }
 function applyProgram(workout,exercises){
  const archived=new Map([...(workout.archivedExercises||[]),...workout.exercises].map(e=>[e.id,clone(e)]));
  exercises.forEach(e=>archived.delete(e.id));
  workout.archivedExercises=[...archived.values()];workout.exercises=clone(exercises);
 }
 const bytesTo64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
 const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const keyBytes=s=>from64(s.replace(/-/g,'+').replace(/_/g,'/'));
 function empty(workouts){return {schemaVersion:3,workouts:clone(workouts),entries:[]};}
 function validateDoc(doc){
  if(doc?.schemaVersion!==3||!Array.isArray(doc.workouts)||!Array.isArray(doc.entries))throw new Error('Неподдерживаемый формат дневника. Данные не изменены.');
  const ids=new Set();
  for(const e of doc.entries){if(typeof e.id!=='string'||ids.has(e.id)||!Number.isInteger(e.version)||e.version<0||!Array.isArray(e.exercises))throw new Error('Повреждённый файл дневника. Данные не изменены.');ids.add(e.id);}
  return doc;
 }
 async function encrypt(doc,key,cryptoApi=root.crypto){
  const raw=keyBytes(key);if(raw.length!==32)throw new Error('Код восстановления должен содержать 32 байта.');
  const imported=await cryptoApi.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const iv=cryptoApi.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(validateDoc(doc)));
  const encrypted=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv},imported,data);
  return {format:FORMAT,iv:bytesTo64(iv),ciphertext:bytesTo64(new Uint8Array(encrypted))};
 }
 async function decrypt(envelope,key,cryptoApi=root.crypto){
  if(envelope?.format!==FORMAT)throw new Error('Неподдерживаемый зашифрованный файл.');
  try{
   const raw=keyBytes(key);if(raw.length!==32)throw new Error();
   const imported=await cryptoApi.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
   const plain=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},imported,from64(envelope.ciphertext));
   return validateDoc(JSON.parse(new TextDecoder().decode(plain)));
  }catch{throw new Error('Код восстановления не подходит или файл повреждён. Данные не изменены.');}
 }
 class GitHubStore{
  constructor(options={}){
   this.storage=options.storage||root.localStorage;this.fetch=options.fetch||root.fetch.bind(root);this.crypto=options.crypto||root.crypto;
   this.workouts=options.workouts||[];this.lock=options.lock||((fn)=>root.navigator?.locks?root.navigator.locks.request(STORAGE,fn):fn());
   this.chain=Promise.resolve();this.status={kind:'disconnected',message:'Подключи GitHub для общей истории.'};this.conflicts=[];this.load();
  }
  load(){
   let saved;try{saved=JSON.parse(this.storage.getItem(STORAGE)||'null');}catch{throw new Error('Не удалось прочитать память браузера. Сохранённые данные не заменены.');}
   this.settings=saved?.settings||null;this.doc=normalizePrograms(saved?.doc?validateDoc(saved.doc):empty(this.workouts));this.pending=saved?.pending||[];this.pendingPrograms=saved?.pendingPrograms||[];this.lastSynced=saved?.lastSynced||null;
   for(const op of this.pendingPrograms){op.baseExercises=normalizeExercises(op.baseExercises);op.exercises=normalizeExercises(op.exercises);}
  }
  persist(){
   try{this.storage.setItem(STORAGE,JSON.stringify({settings:this.settings,doc:this.doc,pending:this.pending,pendingPrograms:this.pendingPrograms,lastSynced:this.lastSynced}));}
   catch{throw new Error('Память браузера недоступна или заполнена. Запись не подтверждена; скачай резервную копию.');}
  }
  run(fn){const next=this.chain.then(()=>this.lock(async()=>{this.load();return fn();}));this.chain=next.catch(()=>{});return next;}
  get connected(){return Boolean(this.settings?.token&&this.settings?.key);}
  get pendingCount(){return this.pending.length+this.pendingPrograms.length;}
  data(){
   const entries=this.doc.entries.filter(e=>!e.deleted).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
   return {schemaVersion:2,workouts:clone(this.doc.workouts),history:clone(entries),trash:clone(this.doc.entries.filter(e=>e.deleted)),editable:this.connected};
  }
  async api(path,options={}){
   let res;try{res=await this.fetch('https://api.github.com/repos/'+REPO+path,{...options,credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.settings.token,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(20000)});}
   catch{throw new Error('GitHub недоступен. Сохранённые на устройстве изменения будут отправлены при восстановлении связи.');}
   if(!res.ok){const error=new Error(res.status===401?'GitHub отклонил ключ доступа. Проверь срок действия ключа.':res.status===403?'GitHub не разрешил запись или временно ограничил запросы. Проверь доступ Contents: Read and write.':res.status===404?'Файл дневника не найден или ключу не разрешён доступ к my-training.':res.status===409?'Дневник одновременно изменился на другом устройстве.':'GitHub вернул ошибку '+res.status+'. Локальные записи сохранены.');error.status=res.status;throw error;}
   return res.json();
  }
  async remote(){
   const value=await this.api('/contents/'+FILE+'?ref='+BRANCH);
   if(value.encoding!=='base64'||!value.content||!value.sha)throw new Error('GitHub вернул неполный файл. Локальные записи сохранены.');
   const raw=new TextDecoder().decode(from64(value.content.replace(/\s/g,'')));
   const doc=await decrypt(JSON.parse(raw),this.settings.key,this.crypto),before=JSON.stringify(doc.workouts);
   normalizePrograms(doc);
   return {sha:value.sha,doc,programUpgrade:before!==JSON.stringify(doc.workouts)};
  }
  async connect(input){return this.run(async()=>{
   let token=String(input.token||'').trim(),key=String(input.key||'').replace(/\s/g,'');
   if(input.code){try{const raw=String(input.code).trim();if(!raw.startsWith('MT1.'))throw new Error();const parsed=JSON.parse(new TextDecoder().decode(from64(raw.slice(4))));token=parsed.token;key=parsed.key;}catch{throw new Error('Неверный код подключения. Скопируй его целиком с первого устройства.');}}
   if(typeof token!=='string'||!/^github_pat_[A-Za-z0-9_]+$|^ghp_[A-Za-z0-9]+$/.test(token)||token.length<25)throw new Error('Вставь ключ GitHub, начинающийся с github_pat_.');
   try{if(keyBytes(key).length!==32)throw new Error();}catch{throw new Error('Вставь код восстановления из сообщения о переносе дневника.');}
   if(this.pendingCount&&this.settings?.key!==key)throw new Error('На устройстве есть неотправленные изменения другого подключения. Сначала синхронизируй их.');
   const previous=this.settings;this.settings={token,key};
   try{const remote=await this.remote();this.settings={token,key};this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return await this.syncUnlocked();}
   catch(e){if(!this.pendingCount){this.settings=previous;this.load();}throw e;}
  });}
  connectionCode(){if(!this.connected)throw new Error('Сначала подключи GitHub.');return 'MT1.'+bytesTo64(new TextEncoder().encode(JSON.stringify({token:this.settings.token,key:this.settings.key})));}
  async disconnect(){return this.run(async()=>{if(this.pendingCount)throw new Error('Сначала отправь ожидающие изменения. Подключение сохранено.');this.settings=null;this.doc=empty(this.workouts);this.lastSynced=null;this.persist();this.status={kind:'disconnected',message:'Устройство отключено. Дневник на GitHub сохранён.'};});}
  replay(remote,operations,programs=this.pendingPrograms){
   const doc=clone(remote),conflicts=[],acknowledged=[];
   for(const op of programs){
    const workout=doc.workouts.find(w=>w.id===op.workoutId);
    if(!workout)throw new Error('Тренировка не найдена. Локальная программа сохранена.');
    if(sameExercises(workout.exercises,op.exercises)){acknowledged.push(op.opId);continue;}
    if(!sameExercises(workout.exercises,op.baseExercises)){
     conflicts.push({kind:'program',id:'program-'+op.workoutId,workoutId:op.workoutId,local:clone(op.exercises),remote:clone(workout.exercises)});continue;
    }
    applyProgram(workout,op.exercises);
   }
   for(const op of operations){
    const index=doc.entries.findIndex(e=>e.id===op.id),current=doc.entries[index];
    if(current?.lastOperation===op.opId){acknowledged.push(op.opId);continue;}
    if((current?.version??null)!==op.baseVersion){conflicts.push({id:op.id,local:clone(op.value),remote:current?clone(current):null});continue;}
    const value={...clone(op.value),version:(current?.version||0)+1,lastOperation:op.opId};
    if(index<0)doc.entries.push(value);else doc.entries[index]=value;
   }
   return {doc,conflicts,acknowledged};
  }
  async sync(){return this.run(()=>this.syncUnlocked());}
  async syncUnlocked(){
   if(!this.connected)return this.data();
   this.status={kind:'syncing',message:'Синхронизация с GitHub…'};
   try{
    for(let attempt=0;attempt<3;attempt++){
     const remote=await this.remote(),operations=clone(this.pending),programs=clone(this.pendingPrograms),merged=this.replay(remote.doc,operations,programs);
     this.conflicts=merged.conflicts;
     if(merged.conflicts.length){
      // Keep local values visible and queue intact until the user decides.
      const visible=clone(merged.doc);for(const conflict of merged.conflicts){
       if(conflict.kind==='program'){applyProgram(visible.workouts.find(w=>w.id===conflict.workoutId),conflict.local);continue;}
       const i=visible.entries.findIndex(e=>e.id===conflict.id);if(i<0)visible.entries.push(conflict.local);else visible.entries[i]=conflict.local;
      }
      this.doc=visible;this.persist();this.status={kind:'conflict',message:'На двух устройствах изменены одни данные. Выбери версию в настройках синхронизации.'};return this.data();
     }
     const toWrite=[...operations,...programs].filter(o=>!merged.acknowledged.includes(o.opId));
     if(toWrite.length||remote.programUpgrade){
      const envelope=await encrypt(merged.doc,this.settings.key,this.crypto);
      try{await this.api('/contents/'+FILE,{method:'PUT',body:JSON.stringify({message:'Sync training diary',branch:BRANCH,sha:remote.sha,content:bytesTo64(new TextEncoder().encode(JSON.stringify(envelope)))})});}
      catch(e){if(e.status===409||e.status===422){if(attempt<2)continue;}throw e;}
     }
     this.doc=merged.doc;this.pending=[];this.pendingPrograms=[];this.lastSynced=new Date().toISOString();this.persist();this.status={kind:'synced',message:'Все изменения сохранены на GitHub.'};return this.data();
    }
   }catch(e){this.status={kind:'offline',message:e.message};throw e;}
  }
  validateSession(value){
   const workout=this.doc.workouts.find(w=>w.id===String(value.workoutId));
   if(!workout||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date))||new Date(value.date).toISOString().slice(0,10)!==value.date)throw new Error('Проверь дату и номер тренировки.');
   const current=this.doc.entries.find(e=>e.id===value.id);
   if(current&&current.workoutId!==workout.id)throw new Error('Нельзя изменить номер сохранённой тренировки.');
   const known=[...(current?current.exercises.map(e=>({id:e.exerciseId,name:e.name})):[]),...workout.exercises,...(workout.archivedExercises||[])];
   if(typeof value.id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(value.id)||!Array.isArray(value.exercises)||!value.exercises.length||value.exercises.length>200)throw new Error('Неверная запись тренировки.');
   const ids=new Set();const exercises=value.exercises.map(item=>{
    const ex=known.find(e=>e.id===item.exerciseId);
    if(!ex||ids.has(ex.id))throw new Error('Список упражнений изменился. Обнови программу; черновик сохранён.');
    ids.add(ex.id);
    if(!item||!Array.isArray(item.setDetails)||!item.setDetails.length||item.setDetails.length>12)throw new Error('Проверь количество подходов.');
    const setDetails=item.setDetails.map(s=>{if(typeof s.weight!=='number'||!Number.isFinite(s.weight)||s.weight<0||s.weight>1000||!Number.isInteger(s.reps)||s.reps<1||s.reps>200||typeof s.done!=='boolean')throw new Error('Проверь вес и повторы.');return {weight:s.weight,reps:s.reps,done:s.done};});
    const done=setDetails.filter(s=>s.done);return {exerciseId:ex.id,name:ex.name,setDetails,completed:!!done.length,weight:done[0]?.weight??setDetails[0].weight,reps:done[0]?.reps??setDetails[0].reps,sets:done.length};
   });
   if(!exercises.some(e=>e.completed))throw new Error('Отметь хотя бы один выполненный подход.');
   return {...value,workoutId:workout.id,notes:String(value.notes||'').slice(0,2000),exercises,deleted:false};
  }
  async mutate(action,value){return this.run(async()=>{
   if(!this.connected)throw new Error('Сначала подключи GitHub для сохранения.');
   const before={doc:clone(this.doc),pending:clone(this.pending)},index=this.doc.entries.findIndex(e=>e.id===value.id),current=this.doc.entries[index];
   if(current&&(value.version??null)!==current.version)throw new Error('Эта запись уже изменилась. Открой актуальную запись из истории; введённый черновик сохранён.');
   if(!current&&value.version!=null)throw new Error('Запись не найдена. Черновик сохранён.');
   let next;
   if(action==='save'){if(current?.deleted)throw new Error('Запись в корзине. Сначала восстанови её.');next=this.validateSession(value);}
   else{if(!current)throw new Error('Запись не найдена.');next={...current,deleted:action==='delete'};}
   next={...next,createdAt:current?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),version:(current?.version||0)+1};
   const previous=this.pending.find(o=>o.id===value.id);
   const operation={id:value.id,baseVersion:previous?previous.baseVersion:(current?.version??null),value:next,opId:this.crypto.randomUUID()};
   this.pending=this.pending.filter(o=>o.id!==value.id);this.pending.push(operation);
   if(index<0)this.doc.entries.push(next);else this.doc.entries[index]=next;
   try{this.persist();}catch(e){this.doc=before.doc;this.pending=before.pending;throw e;}
   try{await this.syncUnlocked();}catch{}
   return {saved:true,synced:!this.pending.length,pending:this.pending.length};
  });}
  async saveProgram(workoutId,items,baseExercises){return this.run(async()=>{
   if(!this.connected)throw new Error('Сначала подключи дневник к GitHub.');
   const workout=this.doc.workouts.find(w=>w.id===workoutId);if(!workout)throw new Error('Тренировка не найдена.');
   const exercises=validateExercises(items);
   if(!sameExercises(workout.exercises,baseExercises))throw new Error('Программа уже изменилась. Закрой редактор и открой его снова.');
   if(sameExercises(workout.exercises,exercises))return {saved:true,synced:!this.pendingCount};
   const before={doc:clone(this.doc),pendingPrograms:clone(this.pendingPrograms)};
   const previous=this.pendingPrograms.find(o=>o.workoutId===workoutId);
   this.pendingPrograms=this.pendingPrograms.filter(o=>o.workoutId!==workoutId);
   this.pendingPrograms.push({workoutId,baseExercises:clone(previous?.baseExercises||workout.exercises),exercises,opId:this.crypto.randomUUID()});
   applyProgram(workout,exercises);
   try{this.persist();}catch(e){this.doc=before.doc;this.pendingPrograms=before.pendingPrograms;throw e;}
   try{await this.syncUnlocked();}catch{}
   return {saved:true,synced:!this.pendingCount};
  });}
  async resolve(id,choice){return this.run(async()=>{
   if(id.startsWith('program-')){
    const remote=await this.remote(),workoutId=id.slice(8),op=this.pendingPrograms.find(o=>o.workoutId===workoutId);if(!op)return;
    if(choice==='remote')this.pendingPrograms=this.pendingPrograms.filter(o=>o.workoutId!==workoutId);
    else if(choice==='local'){const current=remote.doc.workouts.find(w=>w.id===workoutId);if(!current)throw new Error('Тренировка не найдена.');op.baseExercises=clone(current.exercises);op.opId=this.crypto.randomUUID();}
    else throw new Error('Выбери версию программы.');
    this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return this.syncUnlocked();
   }
   const remote=await this.remote(),op=this.pending.find(o=>o.id===id);if(!op)return;
   if(choice==='remote')this.pending=this.pending.filter(o=>o.id!==id);
   else if(choice==='local'){const current=remote.doc.entries.find(e=>e.id===id);op.baseVersion=current?.version??null;op.opId=this.crypto.randomUUID();}
   else throw new Error('Выбери версию записи.');
   this.doc=this.replay(remote.doc,this.pending).doc;this.persist();return this.syncUnlocked();
  });}
 }
 root.TrainingGitHub={GitHubStore,encrypt,decrypt,validateDoc,bytesTo64,from64,catalog,exerciseInfo,exerciseKey};
 if(typeof module!=='undefined')module.exports=root.TrainingGitHub;
})(globalThis);
