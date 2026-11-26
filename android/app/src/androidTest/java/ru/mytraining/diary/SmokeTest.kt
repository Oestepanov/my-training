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
}
