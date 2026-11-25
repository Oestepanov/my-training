const encoder = new TextEncoder();
const json = (value, status = 200, headers = {}) => Response.json(value, {status, headers: {'Cache-Control':'no-store', ...headers}});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2,'0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const deviceLifetime=90*24*60*60*1000;
function allowedOrigin(request) {
  const origin=request.headers.get('Origin');
  return origin===new URL(request.url).origin || origin==='https://oestepanov.github.io';
}
export async function derivePin(pin, salt) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function equal(a,b) { if(typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
const cookie = (value, age = 43200) => `training_unlock=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function setting(env,key,fallback) { return (await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first())?.value ?? fallback; }
async function generation(env) { return setting(env,'generation','initial'); }
function deviceToken(request) {
  return request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] || request.headers.get('Cookie')?.match(/(?:^|;\s*)training_unlock=([a-f0-9]{64})(?:;|$)/)?.[1];
}
async function editable(request,env) {
  const value=deviceToken(request);
  if(!value) return false;
  const row=await env.DB.prepare('SELECT expires,generation FROM unlock_sessions WHERE hash=?').bind(await hash(value)).first();
  return Boolean(row && row.expires>Date.now() && row.generation===await generation(env));
}
function seed(env) { return JSON.parse(env.INITIAL_TRAINING_DATA ? env.INITIAL_TRAINING_DATA+(env.INITIAL_TRAINING_DATA_2||'')+(env.INITIAL_TRAINING_DATA_3||'') : '{"workouts":[],"history":[]}'); }
async function data(env) {
  const initial=seed(env), map=new Map(initial.history.map(s=>[s.id,{...s,version:0,imported:true}]));
  const {results}=await env.DB.prepare('SELECT id,payload,version,deleted FROM entries').all();
  for(const row of results) { if(row.deleted) map.delete(row.id); else map.set(row.id,{...JSON.parse(row.payload),version:row.version}); }
  return {schemaVersion:2,workouts:initial.workouts,history:[...map.values()].sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)))};
}
async function trash(env) {
  const {results}=await env.DB.prepare('SELECT id,payload,version FROM entries WHERE deleted=1').all();
  return results.map(row=>({...JSON.parse(row.payload),id:row.id,version:row.version})).sort((a,b)=>b.date.localeCompare(a.date));
}
function validateSession(value,env) {
  if(!value || typeof value!=='object') fail('Неверная запись.');
  const workout=seed(env).workouts.find(w=>String(w.id)===String(value.workoutId));
  if(!workout) fail('Тренировка не найдена.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0,10)!==value.date) fail('Проверьте дату.');
  if(!Array.isArray(value.exercises) || value.exercises.length!==workout.exercises.length) fail('Неверный список упражнений.');
  const exercises=workout.exercises.map(ex=>{
    const item=value.exercises.find(e=>e.exerciseId===ex.id);
    if(!item || !Array.isArray(item.setDetails) || item.setDetails.length<1 || item.setDetails.length>12) fail('Укажите от 1 до 12 подходов.');
    const setDetails=item.setDetails.map(s=>{
      if(typeof s.weight!=='number' || !Number.isFinite(s.weight) || s.weight<0 || s.weight>1000 || !Number.isInteger(s.reps) || s.reps<1 || s.reps>200 || typeof s.done!=='boolean') fail('Проверьте вес и повторы в подходах.');
      return {weight:s.weight,reps:s.reps,done:s.done};
    });
    const done=setDetails.filter(s=>s.done);
    return {exerciseId:ex.id,name:ex.name,setDetails,completed:done.length>0,weight:done[0]?.weight??setDetails[0].weight,reps:done[0]?.reps??setDetails[0].reps,sets:done.length};
  });
  if(!exercises.some(e=>e.completed)) fail('Отметьте хотя бы один выполненный подход.');
  if(typeof value.id!=='string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value.id)) fail('Неверный идентификатор записи.');
  return {id:value.id,date:value.date,workoutId:String(workout.id),createdAt:new Date().toISOString(),notes:String(value.notes||'').slice(0,2000),exercises};
}
async function handleApi(request,env) {
  try {
    if(!env.DB || !env.PIN_HASH || !env.PIN_SALT || !env.INITIAL_TRAINING_DATA) return json({error:'Сервер ещё настраивается. Обновите страницу чуть позже.'},503);
    const path=new URL(request.url).pathname;
    if(request.method==='GET' && path==='/api/data') {
      const canEdit=await editable(request,env);
      return json({...await data(env),editable:canEdit,trash:canEdit?await trash(env):[]});
    }
    if(request.method==='GET' && path==='/api/devices') {
      if(!await editable(request,env)) fail('Введите PIN для просмотра устройств.',401);
      const {results}=await env.DB.prepare('SELECT hash,label,created_ms,expires FROM unlock_sessions WHERE expires>? AND generation=? ORDER BY created_ms DESC').bind(Date.now(),await generation(env)).all();
      const currentHash=await hash(deviceToken(request));
      return json({devices:results.map(row=>({id:row.hash,label:row.label,createdAt:row.created_ms,expires:row.expires,current:row.hash===currentHash}))});
    }
    if(request.method!=='POST') return json({error:'Не найдено'},404);
    if(!allowedOrigin(request) || !request.headers.get('Content-Type')?.startsWith('application/json')) fail('Запрос отклонён.',403);
    if(Number(request.headers.get('Content-Length'))>100000) fail('Слишком большая запись.',413);
    const raw=await request.text(); if(raw.length>100000) fail('Слишком большая запись.',413);
    let body;try{body=JSON.parse(raw);}catch{fail('Неверный формат записи.');}
    if(!body || typeof body!=='object' || Array.isArray(body)) fail('Неверный формат записи.');
    if(path==='/api/unlock') {
      if(!/^\d{4}$/.test(body.pin)) fail('Введите четыре цифры.');
      const now=Date.now();
      const ipKey=await hash(env.PIN_SALT+(request.headers.get('CF-Connecting-IP')||'unknown'));
      const row=await env.DB.prepare('INSERT INTO pin_attempts (key,count,until_ms) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until_ms<? THEN 1 ELSE count+1 END, until_ms=CASE WHEN until_ms<? THEN excluded.until_ms ELSE until_ms END RETURNING count,until_ms').bind(ipKey,now+900000,now,now).first();
      if(row.count>5) fail('Слишком много попыток. Повторите через 15 минут.',429);
      const currentHash=await setting(env,'pin_hash',env.PIN_HASH), salt=await setting(env,'pin_salt',env.PIN_SALT);
      if(!equal(await derivePin(body.pin,salt),currentHash)) fail('Неверный PIN.',403);
      const value=random(), expires=now+(body.remember===true?deviceLifetime:43200000);
      const label=typeof body.deviceName==='string'?body.deviceName.trim().slice(0,80):'Устройство';
      await env.DB.batch([
        env.DB.prepare('DELETE FROM pin_attempts WHERE key=? OR until_ms<?').bind(ipKey,now),
        env.DB.prepare('DELETE FROM unlock_sessions WHERE expires<?').bind(now),
        env.DB.prepare('INSERT INTO unlock_sessions (hash,expires,generation,label,created_ms) VALUES (?,?,?,?,?)').bind(await hash(value),expires,await generation(env),label||'Устройство',now)
      ]);
      return json({ok:true,deviceToken:value,expires},200,{'Set-Cookie':cookie(value,Math.floor((expires-now)/1000))});
    }
    if(path==='/api/lock') {
      const value=deviceToken(request);
      if(value) await env.DB.prepare('DELETE FROM unlock_sessions WHERE hash=?').bind(await hash(value)).run();
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(!await editable(request,env)) fail('Введите PIN для редактирования.',401);
    if(path==='/api/revoke-device') {
      if(typeof body.id!=='string' || !/^[a-f0-9]{64}$/.test(body.id)) fail('Устройство не найдено.');
      await env.DB.prepare('DELETE FROM unlock_sessions WHERE hash=?').bind(body.id).run();
      return json({ok:true});
    }
    if(path==='/api/restore') {
      if(typeof body.id!=='string' || !Number.isInteger(body.version)) fail('Неверная запись.');
      const result=await env.DB.prepare('UPDATE entries SET deleted=0,version=version+1 WHERE id=? AND version=? AND deleted=1').bind(body.id,body.version).run();
      if(result.meta.changes!==1) fail('Запись уже изменена или восстановлена. Обновите историю.',409);
      return json({ok:true});
    }
    if(path==='/api/pin') {
      if(!/^\d{4}$/.test(body.pin)) fail('Новый PIN должен состоять из четырёх цифр.');
      const salt=random(), derived=await derivePin(body.pin,salt), gen=random();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('pin_hash',derived),
        env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('pin_salt',salt),
        env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('generation',gen),
        env.DB.prepare('DELETE FROM unlock_sessions')
      ]);
      return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    if(path==='/api/session' || path==='/api/delete') {
      const current=await data(env), existing=current.history.find(s=>s.id===body.id);
      if(existing && body.version!==existing.version) fail('Запись изменилась на другом устройстве. Обновите историю перед редактированием.',409);
      if(path==='/api/delete' && !existing) fail('Запись не найдена.',404);
      const session=path==='/api/session'?validateSession(body,env):existing;
      if(existing && path==='/api/session') {
        session.createdAt=existing.createdAt;
        session.updatedAt=new Date().toISOString();
        if(existing.imported) session.imported=true;
        if(existing.sourceNote) session.sourceNote=existing.sourceNote;
      }
      let result;
      if(existing?.version>0) result=await env.DB.prepare('UPDATE entries SET payload=?,version=version+1,deleted=? WHERE id=? AND version=?').bind(JSON.stringify(session),path==='/api/delete'?1:0,session.id,existing.version).run();
      else result=await env.DB.prepare('INSERT INTO entries (id,payload,version,deleted) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(session.id,JSON.stringify(session),path==='/api/delete'?1:0).run();
      if(result.meta.changes!==1) fail('Запись уже изменилась. Обновите историю.',409);
      return json({ok:true});
    }
    return json({error:'Не найдено'},404);
  } catch(error) { return json({error:error.status?error.message:'Не удалось выполнить запрос. Попробуйте ещё раз.'},error.status||500); }
}
export async function api(request,env) {
  const origin=request.headers.get('Origin');
  if(request.method==='OPTIONS') {
    if(!allowedOrigin(request))return json({error:'Источник запроса не разрешён.'},403);
    return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store'}});
  }
  const response=await handleApi(request,env);
  if(origin && allowedOrigin(request)) {
    response.headers.set('Access-Control-Allow-Origin',origin);
    response.headers.set('Vary','Origin');
  }
  response.headers.set('X-Content-Type-Options','nosniff');
  return response;
}
