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
 private lateinit var browser:WebView
 private val site="https://oestepanov.github.io/my-training/"
 private val apiOrigin="https://ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site"
 private var pageReady=false
 private var pageError=""
 private fun trusted(url:String?):Boolean{
  val u=Uri.parse(url?:"")
  return u.scheme=="https"&&u.host=="oestepanov.github.io"&&(u.port==-1||u.port==443)&&(u.path=="/my-training/"||u.path=="/my-training/index.html")
 }
 private suspend fun js(script:String):String?=suspendCancellableCoroutine{c->
  if(!trusted(browser.url)){c.resume(null);return@suspendCancellableCoroutine}
  browser.evaluateJavascript(script){raw->
   if(c.isActive)c.resume(runCatching{JSONTokener(raw?:"null").nextValue() as? String}.getOrNull())
  }
 }
 private suspend fun api(path:String,body:JSONObject?=null):JSONObject=withContext(Dispatchers.Main){
  withTimeout(30000){
   while(!pageReady){if(pageError.isNotBlank())throw IllegalStateException(pageError);delay(200)}
   if(!trusted(browser.url))throw IllegalStateException("Страница подключения недоступна")
   val id="r"+UUID.randomUUID().toString().replace("-","")
   val url=JSONObject.quote(apiOrigin+path)
   val payload=body?.let{JSONObject.quote(it.toString())}?:"null"
   val script="""
    (function(){
      window.__nativeRequests=window.__nativeRequests||{};
      var id='$id', body=$payload, headers={'Accept':'application/json'};
      try {
       var raw=localStorage.getItem('my-training-cloudflare-device-v1')||sessionStorage.getItem('my-training-cloudflare-device-v1');
       var d=JSON.parse(raw||'null');
       if(d&&d.expires>Date.now()&&/^[a-f0-9]{64}$/.test(d.token))headers.Authorization='Bearer '+d.token;
      }catch(e){}
      if(body!==null)headers['Content-Type']='application/json';
      var controller=new AbortController(), timer=setTimeout(function(){controller.abort()},12000);
      fetch($url,{method:body===null?'GET':'POST',headers:headers,body:body,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal})
      .then(async function(r){var v;try{v=await r.json()}catch(e){throw Error('Сервер вернул не JSON (HTTP '+r.status+')')};window.__nativeRequests[id]=JSON.stringify({status:r.status,value:v})})
      .catch(function(e){window.__nativeRequests[id]=JSON.stringify({error:e.name==='AbortError'?'Сервер не ответил за 12 секунд':String(e.message||e)})})
      .finally(function(){clearTimeout(timer)});
      return 'started';
    })()
   """.trimIndent()
   if(js(script)!="started")throw IllegalStateException("Не удалось начать запрос через браузер")
   try{
    var raw:String?=null
    while(raw==null){delay(250);raw=js("window.__nativeRequests && window.__nativeRequests['"+id+"'] || null")}
    val result=JSONObject(raw)
    if(result.has("error"))throw IllegalStateException(result.optString("error"))
    val value=result.optJSONObject("value")?:throw IllegalStateException("Некорректный ответ сервера")
    if(result.optInt("status") !in 200..299)throw IllegalStateException(value.optString("error","Ошибка HTTP "+result.optInt("status")))
    value
   }finally{js("if(window.__nativeRequests)delete window.__nativeRequests['"+id+"']; 'done'")}
  }
 }
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState)
  browser=WebView(this).apply{
   settings.javaScriptEnabled=true
   settings.domStorageEnabled=true
   settings.allowFileAccess=false
   settings.allowContentAccess=false
   webViewClient=object:WebViewClient(){
    override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean = request.isForMainFrame&&!trusted(request.url.toString())
    override fun onPageStarted(view:WebView,url:String?,favicon:android.graphics.Bitmap?){pageReady=false;pageError=""}
    override fun onPageFinished(view:WebView,url:String?){pageReady=trusted(url)&&pageError.isBlank()}
    override fun onReceivedError(view:WebView,request:WebResourceRequest,error:WebResourceError){if(request.isForMainFrame){pageError="Не открывается сайт: "+error.description;pageReady=false}}
   }
   loadUrl(site)
  }
  setContent{MaterialTheme(colorScheme=darkColorScheme(primary=lime,onPrimary=bg,background=bg,surface=surface,secondaryContainer=Color(0xFF36472B),onSecondaryContainer=lime,surfaceVariant=Color(0xFF303830),onSurfaceVariant=Color(0xFFC1CABE))){Screen()}}
 }
 @Composable private fun Screen(){
  val scope=rememberCoroutineScope()
  var data by remember{mutableStateOf(JSONObject())}
  var editable by remember{mutableStateOf(false)}
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
   val source=saved?:partial
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
   val incoming=api("/api/data");require(incoming.arr("workouts").length()>0){"Сервер не вернул программу тренировок"};data=incoming;editable=data.optBoolean("editable");prefs.edit().putString("cache",data.toString()).apply()
   if(reset)load(workout)
  }
  fun task(block:suspend ()->Unit){if(busy)return;busy=true;message="";scope.launch{try{block()}catch(e:Exception){message=e.message?:"Ошибка соединения"}finally{busy=false}}}
  LaunchedEffect(Unit){
   val cache=prefs.getString("cache",null)
   if(cache!=null){runCatching{data=JSONObject(cache);load(workout)}}
   busy=true
   try{refresh(true);prefs.edit().putString("cache",data.toString()).apply()}catch(e:Exception){message="Нет соединения. "+(e.message?:"")}finally{busy=false}
  }
  LaunchedEffect(running){while(running&&seconds>0){delay(1000);seconds--};if(seconds==0)running=false}
  Box(Modifier.fillMaxSize()){
  Scaffold(containerColor=bg,bottomBar={NavigationBar(containerColor=surface,modifier=Modifier.height(88.dp)){listOf("Тренировка","История","Прогресс").forEachIndexed{i,t->NavigationBarItem(selected=tab==i,onClick={tab=i},icon={MenuIcon(i,if(tab==i)lime else Color(0xFFB9C2B7))},label={Text(t,fontSize=14.sp)},colors=NavigationBarItemDefaults.colors(indicatorColor=Color(0xFF36472B),selectedTextColor=lime,unselectedTextColor=Color(0xFFB9C2B7)))}}}){padding->
   LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(top=16.dp,bottom=20.dp)){
    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("МОИ ТРЕНИРОВКИ",color=lime,style=MaterialTheme.typography.titleMedium);TextButton(onClick={if(editable)task{refresh(false)}else{pairing=true;if(!pageReady)browser.reload()}}){Text(if(editable)"Обновить" else "Подключить")}}}
    if(busy)item{Text("Загрузка тренировок…");LinearProgressIndicator(Modifier.fillMaxWidth())}
    if(!busy&&data.arr("workouts").length()==0)item{Text("Тренировки пока не загружены");Button(onClick={pageReady=false;pageError="";browser.reload();task{refresh(true)}}){Text("Повторить подключение")}}
    if(message.isNotBlank())item{Text(message,color=lime);TextButton(onClick={task{refresh(true);prefs.edit().putString("cache",data.toString()).apply()}}){Text("Обновить")}}
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
       api("/api/session",payload());prefs.edit().remove("draft_"+workout).apply();refresh(true);prefs.edit().putString("cache",data.toString()).apply();message="Тренировка сохранена"
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
  if(pairing){
   Surface(Modifier.fillMaxSize(),color=bg){
    Column(Modifier.fillMaxSize().systemBarsPadding()){
     Text("Подключение устройства",style=MaterialTheme.typography.titleLarge,modifier=Modifier.padding(16.dp))
     Text("На сайте открой редактирование и оставь включённым запоминание устройства. Затем нажми «Готово».",modifier=Modifier.padding(horizontal=16.dp))
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){
      TextButton(onClick={pairing=false}){Text("Назад")}
      TextButton(onClick={pageReady=false;pageError="";browser.reload()}){Text("Обновить сайт")}
      TextButton(enabled=!busy,onClick={task{refresh(exercises.isEmpty());require(editable){"Сайт ещё не подтвердил устройство"};pairing=false}}){Text("Готово")}
     }
     if(message.isNotBlank())Text(message,color=lime,modifier=Modifier.padding(12.dp))
     Box(Modifier.weight(1f).fillMaxWidth()){}
    }
   }
  }
  // Keep one browser instance attached, with no native JavaScript bridge.
  AndroidView(factory={browser},modifier=if(pairing) Modifier.fillMaxWidth().fillMaxHeight(.77f).align(Alignment.BottomCenter).navigationBarsPadding() else Modifier.size(1.dp).align(Alignment.BottomEnd))
  }
 }
 override fun onDestroy(){browser.destroy();super.onDestroy()}
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
