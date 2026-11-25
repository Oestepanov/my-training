import {trainingServices} from './api.js';

const toolSchema={type:'object',additionalProperties:false};
const daySchema={type:'string',description:'Дата YYYY-MM-DD. Если пользователь сказал «сегодня» или не назвал дату, пропустить: сервер определит сегодня в Asia/Krasnoyarsk.'};
const workoutSchema={type:'integer',enum:[1,2,3],description:'Номер личной тренировки пользователя: 1, 2 или 3.'};
const targetSchema={date:daySchema,workout_number:workoutSchema,session_id:{type:'string',description:'Идентификатор конкретного занятия из get_training_state. Нужен, если за день есть несколько занятий с тем же номером.'}};
export const trainingTools=[
 {name:'get_training_state',title:'Посмотреть мой дневник тренировок',description:'Прочитать активную тренировку, упражнения, предыдущие результаты, выполненные подходы и то, что осталось. Использовать для вопросов «что осталось», «что было в прошлый раз» и перед записью неоднозначного упражнения. Дата по умолчанию — сегодня по Красноярску. Изменений не делает.',inputSchema:{...toolSchema,properties:targetSchema},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'start_training',title:'Начать мою тренировку',description:'Когда пользователь говорит «сегодня тренировка номер два», выбрать эту тренировку и вернуть программу с предыдущими весами. Запоминает выбранное занятие для последующих сообщений и новых чатов. Не добавляет выполненные подходы. Если несколько занятий за одну дату — уточнить нужное session_id.',inputSchema:{...toolSchema,properties:targetSchema,required:['workout_number']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'record_training_exercise',title:'Записать результат упражнения в мой дневник',description:'Сразу сохранить явно сообщённый пользователем результат в тот же дневник, который открыт на GitHub Pages. Пользовательская команда уже разрешает запись; не ограничиваться текстовым обещанием. Сначала однозначно определить упражнение по программе, вес и повторы. По установленному правилу пользователя, если количество подходов не названо, записать три одинаковых подхода. Для разных повторов использовать reps_per_set, для разных весов set_details. Если речь только об одном конкретном подходе, передать set_number и сохранить только его. Исправление того же упражнения заменяет его результат, повторный вызов не создаёт дубликаты. Не отмечать другие упражнения выполненными. При неопределённых весе/повторах или неоднозначном упражнении уточнить, а не угадывать. Объявлять сохранение только после saved=true.',inputSchema:{...toolSchema,properties:{...targetSchema,exercise:{type:'string',description:'Точный exerciseId из get_training_state либо однозначное название, например «жим на наклонной».'},weight_kg:{type:'number',minimum:0,maximum:1000},reps:{type:'integer',minimum:1,maximum:200},sets:{type:'integer',minimum:1,maximum:12,description:'Если число подходов не названо — 3.'},reps_per_set:{type:'array',minItems:1,maxItems:12,items:{type:'integer',minimum:1,maximum:200}},set_details:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,properties:{weight_kg:{type:'number',minimum:0,maximum:1000},reps:{type:'integer',minimum:1,maximum:200}},required:['weight_kg','reps']}},set_number:{type:'integer',minimum:1,maximum:12,description:'Только если пользователь прямо назвал номер одного подхода. Иначе пропустить.'}},required:['exercise']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'finish_training',title:'Завершить мою тренировку',description:'Завершить активное занятие и вернуть итог. Результаты уже сохранены; невыполненные упражнения не отмечать. Использовать только когда пользователь явно закончил тренировку.',inputSchema:{...toolSchema,properties:{}},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];

function mcpError(message){throw new Error(message);}
function localDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Krasnoyarsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function clean(value){return String(value||'').toLowerCase().replaceAll('ё','е').replace(/[^a-zа-я0-9]+/g,' ').trim();}
function checkDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)mcpError('Уточни дату занятия в формате YYYY-MM-DD.');return value;}
async function activeTraining(env){const row=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('assistant_active_training').first();try{return row?JSON.parse(row.value):null;}catch{return null;}}
async function selectTarget(env,args){
 const all=await trainingServices.data(env), active=await activeTraining(env);
 if(args.workout_number!==undefined&&(!Number.isInteger(args.workout_number)||![1,2,3].includes(args.workout_number)))mcpError('Укажи тренировку 1, 2 или 3.');
 const date=checkDate(args.date||localDay());
 const selected=args.session_id?all.history.find(s=>s.id===args.session_id):null;
 if(args.session_id&&!selected)mcpError('Указанное занятие не найдено. Получи актуальное состояние дневника.');
 if(selected&&((args.date&&selected.date!==args.date)||(args.workout_number&&selected.workoutId!==String(args.workout_number))))mcpError('Дата или номер не совпадают с выбранным занятием.');
 const workoutId=String(selected?.workoutId||args.workout_number||(active?.date===date?active.workoutId:''));
 if(!workoutId)return{all,date,active,workout:null,session:null};
 const workout=all.workouts.find(w=>w.id===workoutId);if(!workout)mcpError('Программа не найдена.');
 const day=selected?.date||date;
 const candidates=all.history.filter(s=>s.date===day&&s.workoutId===workoutId);
 if(!selected&&candidates.length>1)mcpError('За эту дату есть несколько занятий: '+candidates.map(s=>s.id).join(', ')+'. Уточни нужное session_id.');
 return{all,date:day,active,workout,session:selected||candidates[0]||null};
}
function detailed(e){return e?.setDetails||Array.from({length:e?.sets||3},()=>({weight:e?.weight??0,reps:e?.reps||12,done:Boolean(e?.completed)}));}
function previous(all,exerciseId,excludeId,date){
 for(const session of all.history){if(session.id===excludeId||session.date>date)continue;const item=session.exercises.find(e=>e.exerciseId===exerciseId);if(item?.completed)return{date:session.date,sets:detailed(item).filter(s=>s.done).map(s=>({weight_kg:s.weight,reps:s.reps}))};}return null;
}
function summary(target){
 const {all,workout,session,date,active}=target;
 if(!workout)return{date,active_training:active?.date===date?active:null,workouts:all.workouts.map(w=>({workout_number:Number(w.id),name:w.name,exercises:w.exercises.map(e=>({exerciseId:e.id,name:e.name,previous:previous(all,e.id,null,date)}))})),message:'Номер тренировки ещё не выбран. Уточни его перед записью.'};
 const exercises=workout.exercises.map(e=>{const current=session?.exercises.find(x=>x.exerciseId===e.id);const performed=current?detailed(current).filter(s=>s.done):[];return{exerciseId:e.id,name:e.name,previous:previous(all,e.id,session?.id,date),recorded_sets:performed.map(s=>({weight_kg:s.weight,reps:s.reps})),completed:performed.length>0};});
 return{date,workout_number:Number(workout.id),workout_name:workout.name,session_id:session?.id||null,version:session?.version??null,exercises,remaining_exercises:exercises.filter(e=>!e.completed).map(e=>({exerciseId:e.exerciseId,name:e.name})),site_url:'https://oestepanov.github.io/my-training/'};
}
const aliases={
 'bench-press':['жим лежа','жим штанги лежа','горизонтальный жим'],
 'incline-bench-press':['жим на наклонной','наклонный жим','жим на наклонной скамье','жим штанги на наклонной скамье'],
 'leg-press':['жим ногами'],
 'seated-hammer-curl':['молотки','молотки сидя'],
 'lying-leg-curl':['сгибание ног','сгибание ног лежа'],
 'barbell-wrist-curl':['кисти','сгибание кистей','закатка'],
 'lat-pulldown':['вертикальная тяга','тяга вертикального блока','верхний блок'],
 'lateral-raise':['махи','махи в стороны','разведения в стороны'],
 'reverse-pec-deck':['обратная бабочка'],
 'assisted-pull-up':['гравитрон','брусья в гравитроне'],
 'dumbbell-curl':['сгибание рук','сгибание с гантелями','сгибание рук с гантелями'],
 'pec-deck':['бабочка'],
 'triceps-pushdown':['разгибание рук','трицепс','канат','разгибание на блоке'],
 'pullover':['пуловер','пулловер']
};
function resolveExercise(workout,value){
 const name=clean(value);
 const exact=workout.exercises.filter(e=>name===clean(e.id)||name===clean(e.name)||(aliases[e.id]||[]).some(a=>clean(a)===name));
 if(exact.length===1)return exact[0];
 mcpError('Уточни упражнение. В этой программе: '+workout.exercises.map(e=>e.name+' ['+e.id+']').join('; ')+'.');
}
function reportedSets(args){
 const finiteWeight=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1000;
 const validReps=x=>Number.isInteger(x)&&x>=1&&x<=200;
 if(args.set_details!==undefined){
   if(args.reps!==undefined||args.reps_per_set!==undefined||args.weight_kg!==undefined||args.sets!==undefined||args.set_number!==undefined)mcpError('Для set_details не передавай другие способы задания подходов.');
   if(!Array.isArray(args.set_details)||args.set_details.length<1||args.set_details.length>12)mcpError('Укажи от 1 до 12 подходов.');
   return args.set_details.map(s=>{if(!s||!finiteWeight(s.weight_kg)||!validReps(s.reps))mcpError('Уточни вес и повторы каждого подхода.');return{weight:s.weight_kg,reps:s.reps,done:true};});
 }
 if(!finiteWeight(args.weight_kg))mcpError('Какой вес был в этом упражнении?');
 if(args.reps_per_set!==undefined){
   if(args.reps!==undefined||args.set_number!==undefined)mcpError('Укажи либо повторы по подходам, либо результат одного подхода.');
   if(!Array.isArray(args.reps_per_set)||!args.reps_per_set.length||args.reps_per_set.length>12||!args.reps_per_set.every(validReps))mcpError('Уточни повторы по каждому подходу.');
   if(args.sets!==undefined&&args.sets!==args.reps_per_set.length)mcpError('Количество подходов не совпадает со списком повторов.');
   return args.reps_per_set.map(reps=>({weight:args.weight_kg,reps,done:true}));
 }
 if(!validReps(args.reps))mcpError('Сколько повторений было в подходе?');
 if(args.set_number!==undefined){if(!Number.isInteger(args.set_number)||args.set_number<1||args.set_number>12||args.sets!==undefined)mcpError('Уточни номер одного подхода, без общего числа подходов.');return[{weight:args.weight_kg,reps:args.reps,done:true}];}
 const count=args.sets??3;if(!Number.isInteger(count)||count<1||count>12)mcpError('Укажи от 1 до 12 подходов.');
 return Array.from({length:count},()=>({weight:args.weight_kg,reps:args.reps,done:true}));
}
async function callTrainingTool(name,args,env){
 if(!args||typeof args!=='object'||Array.isArray(args))mcpError('Неверные аргументы.');
 if(name==='finish_training'){
   const active=await activeTraining(env);
   if(!active)return{finished:true,message:'Активной тренировки нет. Ранее сохранённые результаты остаются в дневнике.'};
   const target=await selectTarget(env,{workout_number:Number(active.workoutId),date:active.date,...(active.sessionId?{session_id:active.sessionId}:{})});
   await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('assistant_active_training').run();
   return{finished:true,...summary(target),message:'Результаты сохранены. Невыполненные упражнения не добавлены.'};
 }
 const target=await selectTarget(env,args);
 if(name==='get_training_state')return summary(target);
 if(!target.workout)mcpError('Сначала уточни номер тренировки и вызови start_training либо передай workout_number.');
 if(name==='start_training'){
   const active={date:target.date,workoutId:target.workout.id,sessionId:target.session?.id||null};
   await env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('assistant_active_training',JSON.stringify(active)).run();
   return{started:true,...summary(target),message:'Тренировка выбрана. Выполненные подходы ещё не добавлены.'};
 }
 if(name!=='record_training_exercise')mcpError('Неизвестный инструмент.');
 const exercise=resolveExercise(target.workout,args.exercise), performed=reportedSets(args);
 const current=target.session;
 const exercises=target.workout.exercises.map(e=>{
   const entry=current?.exercises.find(x=>x.exerciseId===e.id);
   const last=previous(target.all,e.id,current?.id,target.date);
   let setDetails=entry?detailed(entry).map(s=>({...s})):Array.from({length:3},(_,i)=>({weight:last?.sets[i]?.weight_kg??last?.sets[0]?.weight_kg??0,reps:last?.sets[i]?.reps??last?.sets[0]?.reps??12,done:false}));
   if(e.id===exercise.id){
     if(args.set_number!==undefined){while(setDetails.length<args.set_number)setDetails.push({...performed[0],done:false});setDetails[args.set_number-1]=performed[0];}
     else setDetails=performed;
   }
   return{exerciseId:e.id,setDetails};
 });
 const id=current?.id||'voice-'+target.date+'-'+target.workout.id;
 const proposed={id,date:target.date,workoutId:target.workout.id,notes:current?.notes||'',exercises};
 const normalized=trainingServices.validateSession(proposed,env);
 if(current){normalized.createdAt=current.createdAt;if(current.imported)normalized.imported=true;if(current.sourceNote)normalized.sourceNote=current.sourceNote;}
 const oldExercise=current?.exercises.find(e=>e.exerciseId===exercise.id);
 const unchanged=oldExercise&&JSON.stringify(detailed(oldExercise))===JSON.stringify(exercises.find(e=>e.exerciseId===exercise.id).setDetails);
 let version=current?.version||0;
 if(!unchanged){
   normalized.updatedAt=new Date().toISOString();
   let result;
   if(current?.version>0)result=await env.DB.prepare('UPDATE entries SET payload=?,version=version+1 WHERE id=? AND version=? AND deleted=0').bind(JSON.stringify(normalized),id,current.version).run();
   else result=await env.DB.prepare('INSERT INTO entries (id,payload,version,deleted) VALUES (?,?,1,0) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(normalized)).run();
   if(result.meta.changes!==1)mcpError('Запись изменилась одновременно на другом устройстве или находится в корзине. Получи актуальное состояние и уточни действие. Ничего не перезаписано.');
   version++;
 }
 await env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('assistant_active_training',JSON.stringify({date:target.date,workoutId:target.workout.id,sessionId:id})).run();
 const saved={...normalized,version};
 return{saved:true,unchanged:Boolean(unchanged),exercise_name:exercise.name,recorded_sets:exercises.find(e=>e.exerciseId===exercise.id).setDetails.map((s,i)=>({set_number:i+1,weight_kg:s.weight,reps:s.reps,completed:s.done})),...summary({...target,session:saved})};
}

export async function mcp(request,env){
 const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='POST')return response({error:'Method not allowed'},405);
 let rpc;try{const raw=await request.text();if(raw.length>100000)return response({error:'Request too large'},413);rpc=JSON.parse(raw);}catch{return response({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}},400);}
 if(!rpc||typeof rpc!=='object'||Array.isArray(rpc)||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return response({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32600,message:'Invalid request'}},400);
 const answer=result=>response({jsonrpc:'2.0',id:rpc.id??null,result});
 if(rpc.method==='server/discover')return answer({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(rpc.method==='initialize')return answer({protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'my-training-diary',version:'1.0.0'},instructions:'Личный дневник пользователя. Сохраняй явно сообщённые результаты сразу, без выдуманных подходов. По умолчанию три одинаковых подхода; неоднозначности уточняй. Сегодня — по Asia/Krasnoyarsk.'});
 if(rpc.method==='notifications/initialized'||rpc.method==='notifications/cancelled')return new Response(null,{status:202});
 if(rpc.method==='ping')return answer({});
 if(rpc.method==='tools/list')return answer({tools:trainingTools});
 if(rpc.method!=='tools/call')return response({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Unknown method'}});
 const email=request.headers.get('oai-authenticated-user-email');
 if(!env.ASSISTANT_OWNER_EMAIL||!request.headers.get('oai-authenticated-user-id')||email?.toLowerCase()!==env.ASSISTANT_OWNER_EMAIL.toLowerCase())return answer({content:[{type:'text',text:'Запись через ассистента доступна только владельцу дневника через его подключённый плагин ChatGPT.'}],isError:true});
 const name=rpc.params?.name;
 if(!trainingTools.some(t=>t.name===name))return answer({content:[{type:'text',text:'Неизвестный инструмент.'}],isError:true});
 try{
   if(!env.DB||!env.INITIAL_TRAINING_DATA)mcpError('Дневник ещё настраивается.');
   const result=await callTrainingTool(name,rpc.params?.arguments||{},env);
   return answer({content:[{type:'text',text:JSON.stringify(result)}],isError:false});
 }catch(error){return answer({content:[{type:'text',text:error.status||!(error.message?.includes('SQL')||error.message?.includes('D1_'))?error.message:'Не удалось сохранить запись. Ничего не подтверждено; повтори запрос после проверки дневника.'}],isError:true});}
}
