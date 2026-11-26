package ru.mytraining.diary

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.util.Base64
import android.view.*
import android.webkit.*
import android.widget.*
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File

class MainActivity:Activity(){
 private lateinit var web:WebView
 private val localOrigin="https://appassets.androidplatform.net"
 private val home=localOrigin+"/assets/www/index.html"
 private val exportRequest=702
 private val notificationsRequest=703
 private var exportBusy=false
 private var exportingName=""
 private val pendingExcel get()=File(cacheDir,"pending-training-export.xlsx")
 private var pageReady=false
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState)
  window.statusBarColor=Color.rgb(17,20,17);window.navigationBarColor=Color.rgb(17,20,17)
  val root=FrameLayout(this).apply{setBackgroundColor(Color.rgb(17,20,17))}
  root.setOnApplyWindowInsetsListener{view,insets->
   if(Build.VERSION.SDK_INT>=30){
    val bars=insets.getInsets(WindowInsets.Type.systemBars());val ime=insets.getInsets(WindowInsets.Type.ime())
    view.setPadding(bars.left,bars.top,bars.right,maxOf(bars.bottom,ime.bottom))
   }else view.setPadding(insets.systemWindowInsetLeft,insets.systemWindowInsetTop,insets.systemWindowInsetRight,insets.systemWindowInsetBottom)
   insets
  }
  setContentView(root)
  root.post{
   if(Build.VERSION.SDK_INT>=30)window.insetsController?.setSystemBarsAppearance(0,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS)
  }
  WebView.setWebContentsDebuggingEnabled(false)
  web=WebView(this).apply{
   tag="training-webview";setBackgroundColor(Color.rgb(17,20,17))
   settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.databaseEnabled=true
   settings.allowFileAccess=false;settings.allowContentAccess=false
   settings.allowFileAccessFromFileURLs=false;settings.allowUniversalAccessFromFileURLs=false
   settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
   settings.setSupportMultipleWindows(false);settings.javaScriptCanOpenWindowsAutomatically=false
   settings.textZoom=100;settings.builtInZoomControls=false;settings.displayZoomControls=false
  }
  root.addView(web,FrameLayout.LayoutParams(-1,-1))
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
   root.removeAllViews();root.addView(TextView(this).apply{text="Для приложения нужно обновить Android System WebView в магазине приложений.";setTextColor(Color.WHITE);setPadding(32,48,32,32)});return
  }
  WebViewCompat.addWebMessageListener(web,"TrainingAndroid",setOf(localOrigin)){_,message,sourceOrigin,isMainFrame,_->
   if(!isMainFrame||sourceOrigin.toString()!=localOrigin)return@addWebMessageListener
   val raw=message.data?:return@addWebMessageListener
   if(raw.length>12_000_000)return@addWebMessageListener
   try{handleMessage(JSONObject(raw))}catch(e:Exception){toast("Не удалось выполнить действие. "+(e.message?:""))}
  }
  val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
  web.webViewClient=object:WebViewClient(){
   override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse?{
    if(request.url.host=="appassets.androidplatform.net")return loader.shouldInterceptRequest(request.url)
    if(request.url.scheme=="https"&&request.url.host=="api.github.com")return null
    return WebResourceResponse("text/plain","UTF-8",403,"Blocked",emptyMap(),"Blocked".byteInputStream())
   }
   override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean{
    if(request.url.scheme=="https"&&request.url.host=="appassets.androidplatform.net")return false
    if(request.isForMainFrame)openExternal(request.url)
    return true
   }
   override fun onPageFinished(view:WebView,url:String){
    if(!url.startsWith(localOrigin+"/assets/www/"))return
    pageReady=true;restoreTimer()
   }
   override fun onReceivedError(view:WebView,request:WebResourceRequest,error:WebResourceError){
    if(request.isForMainFrame)toast("Не удалось открыть интерфейс. Закрой и снова открой приложение.")
   }
  }
  web.webChromeClient=object:WebChromeClient(){
   override fun onJsAlert(view:WebView,url:String,message:String,result:JsResult):Boolean{
    AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("ОК"){_,_->result.confirm()}.setOnCancelListener{result.cancel()}.show();return true
   }
   override fun onJsConfirm(view:WebView,url:String,message:String,result:JsResult):Boolean{
    AlertDialog.Builder(this@MainActivity).setMessage(message).setPositiveButton("Да"){_,_->result.confirm()}.setNegativeButton("Отмена"){_,_->result.cancel()}.setOnCancelListener{result.cancel()}.show();return true
   }
  }
  exportingName=savedInstanceState?.getString("exportingName")?:""
  exportBusy=exportingName.isNotEmpty()&&pendingExcel.exists()
  web.loadUrl(home)
 }
 private fun handleMessage(data:JSONObject){
  when(data.optString("type")){
   "ready"->restoreTimer()
   "copy"->{val text=data.optString("text");require(text.length<=20000);getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Подключение дневника",text));toast("Код скопирован")}
   "openExternal"->openExternal(Uri.parse(data.optString("url")))
   "export"->saveExcel(data)
   "startTimer"->{
    val at=data.optLong("deadline");require(at>System.currentTimeMillis()&&at<=System.currentTimeMillis()+3_600_000)
    RestAlarm.set(this,at);askTimerPermissions()
   }
   "cancelTimer"->RestAlarm.cancel(this)
  }
 }
 private fun saveExcel(data:JSONObject){
  if(exportBusy){toast("Сначала заверши сохранение предыдущего файла");return}
  val name=data.optString("filename")
  require(name.matches(Regex("[A-Za-z0-9._-]{1,100}\\.xlsx")))
  val bytes=Base64.decode(data.optString("base64"),Base64.DEFAULT)
  require(bytes.size in 4..8_000_000&&bytes[0]==0x50.toByte()&&bytes[1]==0x4b.toByte())
  pendingExcel.writeBytes(bytes);exportingName=name;exportBusy=true
  try{
   startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").putExtra(Intent.EXTRA_TITLE,name),exportRequest)
  }catch(e:Exception){exportBusy=false;pendingExcel.delete();throw e}
 }
 override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){
  super.onActivityResult(requestCode,resultCode,data)
  if(requestCode!=exportRequest)return
  val uri=data?.data
  if(resultCode!=RESULT_OK||uri==null){exportBusy=false;exportingName="";pendingExcel.delete();return}
  Thread{
   val error=runCatching{contentResolver.openOutputStream(uri,"w").use{output->requireNotNull(output);pendingExcel.inputStream().use{it.copyTo(output)}}}.exceptionOrNull()
   pendingExcel.delete()
   runOnUiThread{exportBusy=false;exportingName="";toast(if(error==null)"Файл Excel сохранён" else "Не удалось сохранить файл Excel")}
  }.start()
 }
 private fun openExternal(uri:Uri){
  if(uri.scheme!="https"||uri.host !in setOf("github.com","chatgpt.com","help.openai.com","ihoudini-training-diary.cuddlyhydrangea128.chatgpt.site")){toast("Эта ссылка недоступна в приложении");return}
  try{startActivity(Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE))}catch(_:ActivityNotFoundException){toast("На телефоне не найден браузер")}
 }
 private fun askTimerPermissions(){
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),notificationsRequest);return}
  askExactTimer()
 }
 private fun askExactTimer(){
  if(Build.VERSION.SDK_INT>=31&&!RestAlarm.canSchedule(this)){
   AlertDialog.Builder(this).setTitle("Сигнал при выключенном экране").setMessage("Разреши точные таймеры, чтобы приложение сообщало об окончании отдыха вовремя.").setPositiveButton("Разрешить"){_,_->
    try{startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+packageName)))}catch(_:Exception){toast("Разрешение можно включить в настройках приложения")}
   }.setNegativeButton("Позже",null).show()
  }
 }
 override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,results:IntArray){
  super.onRequestPermissionsResult(requestCode,permissions,results)
  if(requestCode==notificationsRequest&&RestAlarm.deadline(this)>System.currentTimeMillis()){
   if(results.firstOrNull()==PackageManager.PERMISSION_GRANTED)askExactTimer() else toast("Для сигнала таймера нужно разрешить уведомления")
  }
 }
 private fun restoreTimer(){
  if(!pageReady)return
  val at=RestAlarm.deadline(this)
  web.evaluateJavascript("window.TrainingAndroidApp && window.TrainingAndroidApp.restoreTimer("+at+")",null)
 }
 override fun onResume(){
  super.onResume()
  val at=RestAlarm.deadline(this)
  if(at>System.currentTimeMillis())RestAlarm.set(this,at)
  if(::web.isInitialized)restoreTimer()
 }
 override fun onSaveInstanceState(out:Bundle){super.onSaveInstanceState(out);out.putString("exportingName",exportingName)}
 override fun onBackPressed(){if(::web.isInitialized&&web.canGoBack())web.goBack()else super.onBackPressed()}
 override fun onDestroy(){if(::web.isInitialized){web.stopLoading();web.destroy()};super.onDestroy()}
 private fun toast(message:String){Toast.makeText(this,message,Toast.LENGTH_LONG).show()}
}
