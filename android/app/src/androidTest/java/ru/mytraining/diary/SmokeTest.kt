package ru.mytraining.diary

import android.app.Instrumentation
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import android.view.ViewGroup
import android.webkit.WebView
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class SmokeTest{
 @get:Rule val activityRule=ActivityScenarioRule(MainActivity::class.java)
 private lateinit var activity:MainActivity
 private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
 @Before fun attach(){activityRule.scenario.onActivity{activity=it}}
 private fun web()=activity.findViewById<ViewGroup>(android.R.id.content).findViewWithTag<WebView>("training-webview")
 private fun evaluate(script:String):String{
  val latch=CountDownLatch(1);var result=""
  activity.runOnUiThread{web().evaluateJavascript(script){result=it;latch.countDown()}}
  assertTrue("JavaScript timed out",latch.await(15,TimeUnit.SECONDS));return result
 }
 private fun ready(){
  activity
  val until=SystemClock.elapsedRealtime()+30000
  while(SystemClock.elapsedRealtime()<until){
   if(evaluate("!!(document.querySelector('#content') && !document.querySelector('#content').hidden && window.TrainingAndroidApp)")=="true")return
   SystemClock.sleep(150)
  }
  fail("Bundled diary did not load")
 }
 @Test fun testBundledInterfaceAndSecureOfflineStorage(){
  ready()
  assertEquals("true",evaluate("window.isSecureContext && !!crypto.subtle && !!window.TrainingAndroid"))
  assertEquals("3",evaluate("document.querySelectorAll('.workout-option').length"))
  assertEquals("true",evaluate("document.querySelector('[data-seconds=\"180\"]').textContent==='3 мин' && document.querySelector('[data-seconds=\"300\"]').textContent==='5 мин'"))
  assertEquals("true",evaluate("typeof globalThis.TrainingExcel.buildWorkbook==='function'"))
  assertEquals("true",evaluate("localStorage.setItem('android-smoke','ok'); localStorage.getItem('android-smoke')==='ok'"))
  evaluate("localStorage.removeItem('android-smoke')")
 }
 @Test fun testExcelUsesAndroidSavePicker(){
  ready()
  val target=File(activity.cacheDir,"smoke-export.xlsx");target.delete()
  val result=Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,Intent().setData(Uri.fromFile(target)))
  val filter=IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);addDataType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
  val monitor=instrumentation.addMonitor(filter,result,true)
  try{
   evaluate("state.history=[{id:'test-memory-only',date:'2026-11-25',workoutId:'1',exercises:[{exerciseId:'bench-press',name:'Жим лёжа',weight:47,reps:12,sets:3,completed:true}]}];document.querySelector('#exportButton').click();true")
   val until=SystemClock.elapsedRealtime()+15000
   while(SystemClock.elapsedRealtime()<until&&(!target.exists()||target.length()<4))SystemClock.sleep(100)
   assertTrue("Excel was not written through the Android save picker",target.exists()&&target.length()>4)
   val magic=target.inputStream().use{byteArrayOf(it.read().toByte(),it.read().toByte())}
   assertEquals(0x50,magic[0].toInt());assertEquals(0x4b,magic[1].toInt())
   assertTrue("System picker was not opened",monitor.hits>0)
  }finally{instrumentation.removeMonitor(monitor);target.delete();evaluate("state.history=[]")}
 }
 @Test fun testEncryptedOfflineQueueAndReconnect(){
  ready()
  evaluate("""
   window.offlineSmoke='running';
   (async()=>{
    const T=TrainingGitHub, key=T.bytesTo64(crypto.getRandomValues(new Uint8Array(32)));
    let remote=await T.encrypt({schemaVersion:3,workouts:state.workouts,entries:[]},key), online=true;
    const memory=new Map(), storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
    const fetch=async(url,options)=>{
     if(!online)throw Error('offline');
     if(options.method==='PUT')remote=JSON.parse(new TextDecoder().decode(T.from64(JSON.parse(options.body).content)));
     return {ok:true,json:async()=>options.method==='PUT'?{}:{encoding:'base64',sha:'mock',content:T.bytesTo64(new TextEncoder().encode(JSON.stringify(remote)))}};
    };
    const make=()=>new T.GitHubStore({storage,fetch,workouts:state.workouts,lock:f=>f()});
    let s=make();await s.connect({token:'ghp_'+('a'.repeat(36)),key});online=false;
    const workout=s.data().workouts[0];
    await s.mutate('save',{id:'isolated-offline-test',date:'2026-11-25',workoutId:workout.id,exercises:workout.exercises.map(e=>({exerciseId:e.id,setDetails:[{weight:10,reps:12,done:true}]}))});
    s=make();if(s.pending.length!==1||s.data().history.length!==1)throw Error('Offline queue was lost');
    online=true;await s.sync();
    const restored=await T.decrypt(remote,key);
    if(s.pending.length||restored.entries.length!==1||restored.entries[0].id!=='isolated-offline-test')throw Error('Reconnect lost or duplicated a session');
    window.offlineSmoke='ok';
   })().catch(e=>window.offlineSmoke=String(e));true
  """.trimIndent())
  val until=SystemClock.elapsedRealtime()+15000
  while(SystemClock.elapsedRealtime()<until&&evaluate("window.offlineSmoke")=="\"running\"")SystemClock.sleep(100)
  assertEquals("\"ok\"",evaluate("window.offlineSmoke"))
 }
 @Test fun testNativeRestAlarmAndPause(){
  ready()
  for(command in listOf("pm grant ru.mytraining.diary android.permission.POST_NOTIFICATIONS","appops set ru.mytraining.diary SCHEDULE_EXACT_ALARM allow")){
   android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command)).use{it.readBytes()}
  }
  evaluate("timerRemaining=120;document.querySelector('#timerButton').click();true")
  instrumentation.waitForIdleSync()
  assertTrue("Native alarm was not scheduled",RestAlarm.deadline(activity)>System.currentTimeMillis())
  evaluate("document.querySelector('#timerButton').click();true")
  instrumentation.waitForIdleSync()
  assertEquals(0L,RestAlarm.deadline(activity))
  evaluate("timerRemaining=1;document.querySelector('#timerButton').click();true")
  val until=SystemClock.elapsedRealtime()+10000
  val manager=activity.getSystemService(android.app.NotificationManager::class.java)
  while(SystemClock.elapsedRealtime()<until&&manager.activeNotifications.none{it.id==41})SystemClock.sleep(100)
  assertTrue("Rest completion notification was not delivered",manager.activeNotifications.any{it.id==41})
  assertEquals(0L,RestAlarm.deadline(activity))
  manager.cancel(41)
  evaluate("document.querySelector('#timerReset').click();true")
 }
 private fun waitForJavascript(expression:String){
  val until=SystemClock.elapsedRealtime()+15000
  while(SystemClock.elapsedRealtime()<until){if(evaluate(expression)=="true")return;SystemClock.sleep(100)}
  fail("JavaScript condition failed: "+expression+"; program error: "+evaluate("document.querySelector('#programError')?.textContent"))
 }
 @Test fun testCatalogEditorSharesPreviousResultsAndKeepsHistory(){
  ready()
  evaluate("""
   window.programTestReady=false;
   (async()=>{
    const T=TrainingGitHub,key=T.bytesTo64(crypto.getRandomValues(new Uint8Array(32)));
    const initial=structuredClone(state.workouts);window.programOriginal=structuredClone(initial[0].exercises);
    const old={id:'program-history',version:1,workoutId:initial[0].id,date:'2026-10-01',exercises:initial[0].exercises.map(e=>({exerciseId:e.id,name:e.name,completed:true,sets:1,weight:10,reps:12,setDetails:[{weight:10,reps:12,done:true}]}))};
    const pull={id:'pull-history',version:1,workoutId:'3',date:'2026-11-25',exercises:[{exerciseId:'pullover',name:'Пуловер',completed:true,sets:3,weight:8,reps:10,setDetails:Array.from({length:3},()=>({weight:8,reps:10,done:true}))}]};
    window.programEnvelope=await T.encrypt({schemaVersion:3,workouts:initial,entries:[old,pull]},key);
    const memory=new Map();githubStore.storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
    githubStore.fetch=async(url,options)=>{
     if(options.method==='PUT')window.programEnvelope=JSON.parse(new TextDecoder().decode(T.from64(JSON.parse(options.body).content)));
     return {ok:true,json:async()=>options.method==='PUT'?{}:{encoding:'base64',sha:'mock',content:T.bytesTo64(new TextEncoder().encode(JSON.stringify(window.programEnvelope)))}};
    };
    await githubStore.connect({token:'ghp_'+('p'.repeat(36)),key});await refresh();switchWorkout('2');window.programTestReady=true;
   })();true
  """.trimIndent())
  waitForJavascript("window.programTestReady")
  evaluate("document.querySelector('#editProgram').click();document.querySelector('#addExercise').click();const select=document.querySelector('#programRows').lastElementChild.querySelector('select');select.value='pullover';select.dispatchEvent(new Event('change'));true")
  assertEquals("true",evaluate("document.querySelector('#programDialog').open && !document.querySelector('#programRows input')"))
  assertEquals("true",evaluate("document.querySelector('#programRows').lastElementChild.querySelector('.program-previous').textContent.includes('8 кг × 10') && document.querySelector('#programRows').lastElementChild.querySelector('.program-muscles').textContent.includes('Грудь')"))
  assertEquals("true",evaluate("[...document.querySelectorAll('#programRows select')][0].querySelector('option[value=pullover]').disabled"))
  SystemClock.sleep(250)
  android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("screencap -p /data/local/tmp/program-editor.png")).use{it.readBytes()}
  evaluate("document.querySelector('#programForm').requestSubmit();true")
  waitForJavascript("!document.querySelector('#programDialog').open")
  assertEquals("true",evaluate("state.workouts[1].exercises.at(-1).id==='pullover' && document.querySelector('[data-exercise=pullover] .weight').value==='8' && document.querySelector('[data-exercise=pullover] .reps').value==='10' && !document.querySelector('[data-exercise=pullover] .done-check').checked"))
  assertEquals("true",evaluate("document.querySelector('[data-exercise=pullover] .exercise-description').textContent.length>10"))
  evaluate("startEdit('program-history');document.querySelector('#editProgram').click();const replacement=document.querySelector('#programRows select');replacement.value='pullover';replacement.dispatchEvent(new Event('change'));document.querySelectorAll('#programRows .program-row')[1].querySelector('button').click();document.querySelector('#programForm').requestSubmit();true")
  waitForJavascript("!document.querySelector('#programDialog').open")
  assertEquals("true",evaluate("state.workouts[0].exercises.length===window.programOriginal.length-1 && state.workouts[0].exercises[0].id==='pullover' && state.workouts[0].archivedExercises.some(e=>e.id===window.programOriginal[0].id)"))
  assertEquals("true",evaluate("document.querySelectorAll('#exerciseList .exercise').length===window.programOriginal.length && document.querySelector('#exerciseList h3').textContent===window.programOriginal[0].name"))
  evaluate("renderProgress();true")
  assertEquals("true",evaluate("document.querySelectorAll('#exerciseSelect option[value=pullover]').length===1 && [...document.querySelectorAll('#exerciseSelect option')].some(e=>e.value===window.programOriginal[0].id)"))
  evaluate("window.programRemoteOk=false;TrainingGitHub.decrypt(window.programEnvelope,githubStore.settings.key).then(d=>window.programRemoteOk=d.workouts[0].exercises[0].id==='pullover'&&d.workouts[1].exercises.at(-1).id==='pullover'&&d.entries[0].exercises[0].name===window.programOriginal[0].name);true")
  waitForJavascript("window.programRemoteOk")
  evaluate("const legacy={id:'legacy-pull',version:1,workoutId:'2',date:today(),exercises:[{exerciseId:'ex-old-random',name:'Пулловер',completed:false,sets:0,setDetails:Array.from({length:3},()=>({weight:0,reps:12,done:false}))}]};state.history.unshift(legacy);workoutId='2';editId=legacy.id;renderWorkout(legacy);true")
  assertEquals("true",evaluate("document.querySelector('#exerciseList .weight').value==='8' && document.querySelector('#exerciseList .reps').value==='10' && !document.querySelector('#exerciseList .done-check').checked"))
 }
}
