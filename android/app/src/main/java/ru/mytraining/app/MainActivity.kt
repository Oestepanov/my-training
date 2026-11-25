package ru.mytraining.app

import android.os.Bundle
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
 private var token=""
 private suspend fun api(path:String, body:JSONObject?=null):JSONObject=withContext(Dispatchers.IO){
  val c=URL("https://ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site"+path).openConnection() as HttpURLConnection
  try{
   c.connectTimeout=12000;c.readTimeout=12000;c.instanceFollowRedirects=true
   c.setRequestProperty("Accept","application/json")
   c.setRequestProperty("User-Agent","Mozilla/5.0 (Android) MyTraining/2.0")
   c.setRequestProperty("Origin","https://oestepanov.github.io")
   c.setRequestProperty("Cache-Control","no-cache")
   if(token.isNotEmpty()) c.setRequestProperty("Authorization","Bearer "+token)
   if(body!=null){c.requestMethod="POST";c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
   val status=c.responseCode
   val raw=(if(status in 200..299)c.inputStream else c.errorStream)?.bufferedReader()?.use{it.readText()}?:"{}"
   val result=runCatching{JSONObject(raw)}.getOrElse{throw IllegalStateException("Сервер вернул не JSON (HTTP "+status+"). Проверь доступ к сайту и VPN.")}
   if(status !in 200..299){if(status==401){token="";prefs.edit().remove("token").remove("expires").apply()};throw IllegalStateException(result.optString("error","Ошибка сервера: "+status))}
   result
  }finally{c.disconnect()}
 }
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState)
  if(prefs.getLong("expires",0)>System.currentTimeMillis())token=prefs.getString("token","")?:""
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
  var pinDialog by remember{mutableStateOf(false)}
  var pin by remember{mutableStateOf("")}
  var pinError by remember{mutableStateOf("")}
  var pinBusy by remember{mutableStateOf(false)}
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
  Scaffold(containerColor=bg,bottomBar={NavigationBar(containerColor=surface,modifier=Modifier.height(88.dp)){listOf("Тренировка","История","Прогресс").forEachIndexed{i,t->NavigationBarItem(selected=tab==i,onClick={tab=i},icon={MenuIcon(i,if(tab==i)lime else Color(0xFFB9C2B7))},label={Text(t,fontSize=14.sp)},colors=NavigationBarItemDefaults.colors(indicatorColor=Color(0xFF36472B),selectedTextColor=lime,unselectedTextColor=Color(0xFFB9C2B7)))}}}){padding->
   LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(top=16.dp,bottom=20.dp)){
    item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("МОИ ТРЕНИРОВКИ",color=lime,style=MaterialTheme.typography.titleMedium);TextButton(onClick={if(editable)task{api("/api/lock",JSONObject());token="";prefs.edit().remove("token").remove("expires").apply();refresh(false)}else{pin="";pinError="";pinDialog=true}}){Text(if(editable)"Выйти" else "PIN")}}}
    if(busy)item{Text("Загрузка тренировок…");LinearProgressIndicator(Modifier.fillMaxWidth())}
    if(!busy&&data.arr("workouts").length()==0)item{Text("Тренировки пока не загружены");Button(onClick={task{refresh(true)}}){Text("Повторить подключение")}}
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
      }}){Text("Сохранить тренировку")};if(!editable)Text("Для записи результатов введи PIN.")}
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
  if(pinDialog)AlertDialog(onDismissRequest={if(!pinBusy)pinDialog=false},title={Text("Введи PIN")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(pin,{if(it.length<=4&&it.all(Char::isDigit)){pin=it;pinError=""}},label={Text("4 цифры")},visualTransformation=PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.NumberPassword),singleLine=true,enabled=!pinBusy);if(pinBusy)LinearProgressIndicator(Modifier.fillMaxWidth());if(pinError.isNotBlank())Text(pinError,color=MaterialTheme.colorScheme.error)}},confirmButton={TextButton(enabled=pin.length==4&&!pinBusy&&!busy,onClick={pinBusy=true;pinError="";scope.launch{try{val login=api("/api/unlock",JSONObject().put("pin",pin).put("remember",true).put("deviceName","Android "+android.os.Build.MODEL));token=login.getString("deviceToken");prefs.edit().putString("token",token).putLong("expires",login.optLong("expires")).apply();refresh(exercises.isEmpty());require(editable){"Сервер не подтвердил доступ к редактированию"};pin="";pinDialog=false;message=""}catch(e:Exception){pinError=e.message?:"Ошибка подключения"}finally{pinBusy=false}}}){Text(if(pinBusy)"Проверка…" else "Открыть")}},dismissButton={TextButton(enabled=!pinBusy,onClick={pinDialog=false}){Text("Отмена")}})
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
