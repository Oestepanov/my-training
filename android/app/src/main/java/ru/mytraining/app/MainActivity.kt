package ru.mytraining.app

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.net.Uri
import androidx.compose.ui.viewinterop.AndroidView
import kotlin.coroutines.resume
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.Alignment
import kotlinx.coroutines.*
import org.json.*
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.UUID

private val lime=Color(0xFFCBF27B)
private val bg=Color(0xFF111411)
private val surface=Color(0xFF222822)
private fun JSONObject.arr(key:String)=optJSONArray(key)?:JSONArray()
private fun JSONArray.objects()=(0 until length()).mapNotNull{optJSONObject(it)}
private data class SetRow(val weight:String="0",val reps:String="12",val done:Boolean=false)
private data class Exercise(val id:String,val name:String,val previous:String,val rows:List<SetRow>)
class MainActivity:ComponentActivity(){
 private val prefs by lazy{getSharedPreferences("training",MODE_PRIVATE)}
 private val endpoint="https://api.github.com/repos/Oestepanov/my-training-data/contents/data/training.json"
 private fun key():javax.crypto.SecretKey{
  val ks=java.security.KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
  val existing=ks.getKey("training-github",null) as? javax.crypto.SecretKey
  if(existing!=null)return existing
  val gen=javax.crypto.KeyGenerator.getInstance("AES","AndroidKeyStore")
  gen.init(android.security.keystore.KeyGenParameterSpec.Builder("training-github",android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT).setBlockModes("GCM").setEncryptionPaddings("NoPadding").build())
  return gen.generateKey()
 }
 private fun storeToken(value:String){
  val c=javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
  c.init(javax.crypto.Cipher.ENCRYPT_MODE,key())
  prefs.edit().putString("gh_token",android.util.Base64.encodeToString(c.iv+c.doFinal(value.toByteArray()),android.util.Base64.NO_WRAP)).apply()
 }
 private fun token():String=runCatching{
  val raw=android.util.Base64.decode(prefs.getString("gh_token",""),android.util.Base64.DEFAULT)
  val c=javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
  c.init(javax.crypto.Cipher.DECRYPT_MODE,key(),javax.crypto.spec.GCMParameterSpec(128,raw.copyOfRange(0,12)))
  String(c.doFinal(raw.copyOfRange(12,raw.size)),Charsets.UTF_8)
 }.getOrDefault("")
 private suspend fun github(secret:String,body:JSONObject?=null):JSONObject=withContext(Dispatchers.IO){
  require(secret.isNotBlank()){"Сначала подключи GitHub"}
  val c=URL(endpoint).openConnection() as HttpURLConnection
  try{
   c.connectTimeout=12000;c.readTimeout=12000;c.instanceFollowRedirects=false
   c.setRequestProperty("Authorization","Bearer "+secret)
   c.setRequestProperty("Accept","application/vnd.github+json")
   c.setRequestProperty("X-GitHub-Api-Version","2022-11-28")
   if(body!=null){c.requestMethod="PUT";c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
   val status=c.responseCode
   val raw=(if(status in 200..299)c.inputStream else c.errorStream)?.bufferedReader()?.use{it.readText()}?:"{}"
   if(status !in 200..299)throw IllegalStateException("GitHub HTTP "+status+if(status==404||status==403)" — проверь доступ токена к репозиторию" else "")
   JSONObject(raw)
  }finally{c.disconnect()}
 }
 private fun normalize(d:JSONObject):JSONObject{
  d.arr("history").objects().forEach{s->s.arr("exercises").objects().forEach{e->
   if(!e.has("setDetails"))e.put("setDetails",JSONArray().apply{repeat(e.optInt("sets",3).coerceIn(1,12)){put(JSONObject().put("weight",e.optDouble("weight",0.0)).put("reps",e.optInt("reps",12)).put("done",e.optBoolean("completed")) )}})
  }}
  return d
 }
 private fun local():JSONObject=normalize(runCatching{JSONObject(prefs.getString("local_v4","")?:"")}.getOrElse{JSONObject(assets.open("programs.json").bufferedReader().use{it.readText()})})
 private fun persist(d:JSONObject){check(prefs.edit().putString("local_v4",d.toString()).commit()){"Не удалось сохранить данные на телефон"}}
 private fun merge(remote:JSONObject,local:JSONObject):JSONObject{
  val records=linkedMapOf<String,JSONObject>()
  remote.arr("history").objects().forEach{records[it.getString("id")]=it}
  local.arr("history").objects().forEach{if(!records.containsKey(it.getString("id")))records[it.getString("id")]=it}
  return normalize(JSONObject(remote.toString()).put("history",JSONArray(records.values.sortedByDescending{it.optString("date")+it.optString("createdAt")})))
 }
 private suspend fun sync(secret:String,local:JSONObject):JSONObject{
  val file=github(secret)
  val remote=normalize(JSONObject(String(android.util.Base64.decode(file.getString("content"),android.util.Base64.DEFAULT),Charsets.UTF_8)))
  require(remote.arr("workouts").length()>0){"В GitHub отсутствует программа тренировок"}
  val merged=merge(remote,local)
  val remoteIds=remote.arr("history").objects().map{it.getString("id")}.toSet()
  if(merged.arr("history").objects().any{it.getString("id") !in remoteIds}){
   github(secret,JSONObject().put("message","Sync Android training sessions").put("sha",file.getString("sha")).put("content",android.util.Base64.encodeToString(merged.toString(2).toByteArray(Charsets.UTF_8),android.util.Base64.NO_WRAP)))
  }
  return merged
 }
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState)
  setContent{MaterialTheme(colorScheme=darkColorScheme(primary=lime,onPrimary=bg,background=bg,surface=surface,secondaryContainer=Color(0xFF36472B),onSecondaryContainer=lime,surfaceVariant=Color(0xFF303830),onSurfaceVariant=Color(0xFFC1CABE))){Screen()}}
 }
 @Composable private fun Screen(){
  val scope=rememberCoroutineScope()
  var data by remember{mutableStateOf(local())}
  val editable=true
  var busy by remember{mutableStateOf(false)}
  var message by remember{mutableStateOf("")}
  var tab by remember{mutableIntStateOf(0)}
  var workout by remember{mutableStateOf("1")}
  var exercises by remember{mutableStateOf(emptyList<Exercise>())}
  var date by remember{mutableStateOf(LocalDate.now().toString())}
  var notes by remember{mutableStateOf("")}
  var sessionId by remember{mutableStateOf(UUID.randomUUID().toString())}
  var version by remember{mutableStateOf<Any>(JSONObject.NULL)}
  var pairing by remember{mutableStateOf(false)}
  var secret by remember{mutableStateOf("")}
  var connected by remember{mutableStateOf(token().isNotBlank())}
  var selected by remember{mutableStateOf("")}
  var seconds by remember{mutableIntStateOf(90)}
  var running by remember{mutableStateOf(false)}
  fun payload():JSONObject=JSONObject().put("id",sessionId).put("version",version).put("date",date).put("workoutId",workout).put("notes",notes).put("exercises",JSONArray().apply{
   exercises.forEach{e->put(JSONObject().put("exerciseId",e.id).put("setDetails",JSONArray().apply{e.rows.forEach{r->put(JSONObject().put("weight",r.weight.replace(',','.').toDoubleOrNull()?:0.0).put("reps",r.reps.toIntOrNull()?:0).put("done",r.done))}}))}
  })
  fun draft(){prefs.edit().putString("draft_"+workout,payload().toString()).apply()}
  fun load(w:String){
   val history=data.arr("history").objects()
   val program=data.arr("workouts").objects().firstOrNull{it.optString("id")==w}
   val saved=runCatching{JSONObject(prefs.getString("draft_"+w,"")?:"")}.getOrNull()
   val partial=history.filter{it.optString("workoutId")==w&&it.optString("date")==LocalDate.now().toString()&&it.arr("exercises").objects().any{e->!e.optBoolean("completed")}}.singleOrNull()
   val source=saved
   sessionId=source?.optString("id")?:UUID.randomUUID().toString()
   version=source?.opt("version")?:JSONObject.NULL
   date=source?.optString("date")?:LocalDate.now().toString()
   notes=source?.optString("notes")?:""
   exercises=program?.arr("exercises")?.objects()?.map{e->
    val id=e.optString("id")
    val last=history.filter{it.optString("id")!=sessionId}.flatMap{it.arr("exercises").objects()}.firstOrNull{it.optString("exerciseId")==id&&it.optBoolean("completed")}
    val previous=last?.arr("setDetails")?.objects()?.filter{it.optBoolean("done")}?.joinToString(" · "){it.optString("weight")+" × "+it.optString("reps")}?.takeIf{it.isNotBlank()}?:"Нет записи"
    val stored=source?.arr("exercises")?.objects()?.firstOrNull{it.optString("exerciseId")==id}
    val rows=(stored?:last)?.arr("setDetails")?.objects()?.map{SetRow(it.optString("weight","0"),it.optString("reps","12"),stored!=null&&it.optBoolean("done"))}.orEmpty()
    Exercise(id,e.optString("name"),previous,rows.ifEmpty{List(3){SetRow(last?.optString("weight","0")?:"0",last?.optString("reps","12")?:"12")}})
   }.orEmpty()
  }
  suspend fun refresh(reset:Boolean){
   data=sync(token(),data);persist(data);if(reset)load(workout)
  }
  fun task(block:suspend ()->Unit){if(busy)return;busy=true;message="";scope.launch{try{block()}catch(e:Exception){message=e.message?:"Ошибка соединения"}finally{busy=false}}}
  LaunchedEffect(Unit){
   load(workout)
   if(connected)task{refresh(false);if(prefs.getString("draft_"+workout,null)==null)load(workout)}
  }
  LaunchedEffect(running){while(running&&seconds>0){delay(1000);seconds--};if(seconds==0)running=false}
  Box(Modifier.fillMaxSize()){
  Scaffold(containerColor=bg,bottomBar={NavigationBar(containerColor=surface,modifier=Modifier.height(88.dp)){listOf("Тренировка","История","Прогресс").forEachIndexed{i,t->NavigationBarItem(selected=tab==i,onClick={tab=i},icon={MenuIcon(i,if(tab==i)lime else Color(0xFFB9C2B7))},label={Text(t,fontSize=14.sp)},colors=NavigationBarItemDefaults.colors(indicatorColor=Color(0xFF36472B),selectedTextColor=lime,unselectedTextColor=Color(0xFFB9C2B7)))}}}){padding->
   LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(top=16.dp,bottom=20.dp)){
    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("МОИ ТРЕНИРОВКИ",color=lime,style=MaterialTheme.typography.titleMedium);TextButton(onClick={secret="";pairing=true}){Text(if(connected)"GitHub ✓" else "GitHub")}}}
    if(busy)item{Text("Синхронизация GitHub…");LinearProgressIndicator(Modifier.fillMaxWidth())}
    if(!connected)item{Text("Автономный режим · результаты сохраняются на телефоне",color=lime)}
    if(message.isNotBlank())item{Text(message,color=lime);TextButton(onClick={task{refresh(false)}}){Text("Обновить")}}
    when(tab){
     0->{
      item{Text("Твоя тренировка.",style=MaterialTheme.typography.headlineMedium);Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("1","2","3").forEach{w->FilterChip(selected=workout==w,onClick={if(editable&&exercises.isNotEmpty())draft();workout=w;load(w)},label={Text("№ "+w)})}}
      val done=exercises.sumOf{e->e.rows.count{it.done}};val total=exercises.sumOf{it.rows.size}
      Text("$done / $total подходов",color=lime);LinearProgressIndicator(progress={if(total>0)done.toFloat()/total else 0f},modifier=Modifier.fillMaxWidth())
      Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){TextButton(onClick={running=!running;if(seconds==0)seconds=90}){Text((if(running)"Пауза " else "Отдых ")+String.format("%02d:%02d",seconds/60,seconds%60))};TextButton(onClick={running=false;seconds=90}){Text("Сброс")}}
      }
      items(exercises,key={it.id}){e->Card(colors=CardDefaults.cardColors(containerColor=surface)){Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){Text(e.name,style=MaterialTheme.typography.titleLarge);Text("Прошлый раз: "+e.previous,color=lime)
       e.rows.forEachIndexed{i,r->
        fun change(new:SetRow){exercises=exercises.map{ex->if(ex.id==e.id)ex.copy(rows=ex.rows.mapIndexed{j,old->if(i==j)new else old})else ex};draft()}
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Text("${i+1}",modifier=Modifier.padding(top=16.dp));OutlinedTextField(r.weight,{change(r.copy(weight=it))},Modifier.weight(1f),enabled=editable,label={Text("кг")},singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal));OutlinedTextField(r.reps,{change(r.copy(reps=it))},Modifier.weight(1f),enabled=editable,label={Text("повт.")},singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number));Checkbox(r.done,{change(r.copy(done=it))},enabled=editable)}
       }
       Row{TextButton(enabled=editable&&e.rows.size<12,onClick={exercises=exercises.map{if(it.id==e.id)it.copy(rows=it.rows+it.rows.last().copy(done=false))else it};draft()}){Text("+ Подход")};TextButton(enabled=editable&&e.rows.size>1,onClick={exercises=exercises.map{if(it.id==e.id)it.copy(rows=it.rows.dropLast(1))else it};draft()}){Text("Убрать")}}
      }}}
      item{OutlinedTextField(date,{date=it;draft()},enabled=editable,label={Text("Дата (ГГГГ-ММ-ДД)")},modifier=Modifier.fillMaxWidth());OutlinedTextField(notes,{notes=it;draft()},enabled=editable,label={Text("Заметка")},modifier=Modifier.fillMaxWidth());Button(modifier=Modifier.fillMaxWidth(),enabled=editable&&!busy&&exercises.any{e->e.rows.any{it.done}},onClick={task{
       require(runCatching{LocalDate.parse(date)}.isSuccess){"Проверь дату"}
       require(exercises.all{e->e.rows.all{r->(r.weight.replace(',','.').toDoubleOrNull()?:-1.0) in 0.0..1000.0&&(r.reps.toIntOrNull()?:0) in 1..200}}){"Проверь вес и повторения"}
       val entry=payload().put("createdAt",java.time.Instant.now().toString())
       entry.remove("version")
       entry.arr("exercises").objects().forEach{e->
        val id=e.optString("exerciseId");e.put("name",exercises.first{it.id==id}.name)
        val rows=e.arr("setDetails").objects();val done=rows.filter{it.optBoolean("done")}
        e.put("completed",done.isNotEmpty());e.put("sets",rows.size);e.put("weight",done.firstOrNull()?.optDouble("weight")?:0.0);e.put("reps",done.firstOrNull()?.optInt("reps")?:0)
       }
       val history=data.arr("history").objects().filter{it.optString("id")!=entry.optString("id")}
       data=JSONObject(data.toString()).put("history",JSONArray(listOf(entry)+history))
       persist(data);prefs.edit().remove("draft_"+workout).commit();load(workout);message="Сохранено на телефоне"
       if(connected){try{refresh(true);message="Сохранено и синхронизировано"}catch(e:Exception){message="Сохранено на телефоне. GitHub: "+e.message}}
      }}){Text("Сохранить тренировку")};if(!editable)Text("Для записи один раз подтверди устройство на сайте.")}
     }
     1->{item{Text("История.",style=MaterialTheme.typography.headlineMedium)}
      items(data.arr("history").objects()){s->Card{Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){Text(s.optString("date")+" · Тренировка №"+s.optString("workoutId"),color=lime);s.arr("exercises").objects().forEach{e->val rows=e.arr("setDetails").objects().filter{it.optBoolean("done")};if(rows.isNotEmpty())Text(e.optString("name")+": "+rows.joinToString(" · "){it.optString("weight")+" × "+it.optString("reps")})}}}}
     }
     2->{item{Text("Твой прогресс.",style=MaterialTheme.typography.headlineMedium);Text("Тренировок: "+data.arr("history").length(),color=lime)}
      val all=data.arr("workouts").objects().flatMap{it.arr("exercises").objects()}.distinctBy{it.optString("id")}
      val id=selected.ifBlank{all.firstOrNull()?.optString("id")?:""}
      item{var expanded by remember{mutableStateOf(false)};Box{OutlinedButton(onClick={expanded=true}){Text(all.firstOrNull{it.optString("id")==id}?.optString("name")?:"Упражнение")};DropdownMenu(expanded,{expanded=false}){all.forEach{e->DropdownMenuItem(text={Text(e.optString("name"))},onClick={selected=e.optString("id");expanded=false})}}}}
      val points=data.arr("history").objects().reversed().mapNotNull{s->val rows=s.arr("exercises").objects().filter{it.optString("exerciseId")==id}.flatMap{it.arr("setDetails").objects()}.filter{it.optBoolean("done")};val weights=rows.map{it.optDouble("weight",0.0)};if(weights.isEmpty())null else s.optString("date") to (if(id=="assisted-pull-up")weights.minOrNull()!! else weights.maxOrNull()!!)}
      item{if(points.isEmpty())Text("Нет результатов")else{Text("Рабочий вес, кг"+if(id=="assisted-pull-up")" (вес помощи)" else "");Canvas(Modifier.fillMaxWidth().height(180.dp)){val max=(points.maxOf{it.second}*1.1).coerceAtLeast(1.0);val xy=points.mapIndexed{i,p->Offset(if(points.size==1)size.width/2 else 8f+i*(size.width-16f)/(points.size-1),size.height-8f-(p.second/max*(size.height-16f)).toFloat())};xy.zipWithNext().forEach{(a,b)->drawLine(lime,a,b,4f)};xy.forEach{drawCircle(lime,6f,it)}}}}
      items(points.reversed()){p->Text(p.first+"   ·   "+p.second+" кг")}
     }
    }
   }
  }
  if(pairing)AlertDialog(onDismissRequest={if(!busy)pairing=false},title={Text("Подключение GitHub")},text={Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
    Text("Токен с доступом Contents: Read and write только к my-training-data. Он хранится зашифрованным на телефоне.")
    OutlinedTextField(secret,{secret=it},label={Text("Токен GitHub")},visualTransformation=PasswordVisualTransformation(),singleLine=true)
    if(connected)TextButton(enabled=!busy,onClick={pairing=false;task{refresh(false);message="Синхронизировано"}}){Text("Синхронизировать")}
    if(connected)TextButton(enabled=!busy,onClick={prefs.edit().remove("gh_token").apply();connected=false;pairing=false}){Text("Отключить GitHub")}
    if(message.isNotBlank())Text(message,color=lime)
   }},confirmButton={TextButton(enabled=secret.isNotBlank()&&!busy,onClick={task{val merged=sync(secret.trim(),data);persist(merged);storeToken(secret.trim());data=merged;connected=true;secret="";pairing=false;if(prefs.getString("draft_"+workout,null)==null)load(workout);message="GitHub подключён"}}){Text("Подключить")}},dismissButton={TextButton(enabled=!busy,onClick={pairing=false;secret=""}){Text("Закрыть")}})
  }
 }
}
@Composable private fun MenuIcon(index:Int,color:Color){
 Canvas(Modifier.size(28.dp)){
  val w=size.width;val h=size.height;val stroke=2.dp.toPx()
  fun line(x:Float,y:Float,x2:Float,y2:Float){drawLine(color,Offset(x*w,y*h),Offset(x2*w,y2*h),stroke,StrokeCap.Round)}
  when(index){
   0->{line(.17f,.5f,.83f,.5f);line(.25f,.23f,.25f,.77f);line(.75f,.23f,.75f,.77f);line(.1f,.36f,.1f,.64f);line(.9f,.36f,.9f,.64f)}
   1->{drawCircle(color,w*.38f,style=androidx.compose.ui.graphics.drawscope.Stroke(stroke));line(.5f,.27f,.5f,.5f);line(.5f,.5f,.68f,.6f)}
   else->{line(.12f,.12f,.12f,.87f);line(.12f,.87f,.92f,.87f);line(.24f,.7f,.46f,.46f);line(.46f,.46f,.63f,.58f);line(.63f,.58f,.9f,.23f)}
  }
 }
}
