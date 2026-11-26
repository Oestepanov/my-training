package ru.mytraining.diary

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build

internal object RestAlarm {
 const val PREFS="rest_timer_v1"
 const val DEADLINE="deadline"
 private const val CHANNEL="rest_finished"
 fun deadline(context:Context)=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getLong(DEADLINE,0)
 fun canSchedule(context:Context)=Build.VERSION.SDK_INT<31||context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
 private fun pending(context:Context)=PendingIntent.getBroadcast(context,41,Intent(context,RestAlarmReceiver::class.java).setAction("ru.mytraining.diary.REST_FINISHED"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
 fun set(context:Context,at:Long){
  context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putLong(DEADLINE,at).apply()
  val manager=context.getSystemService(AlarmManager::class.java)
  if(canSchedule(context))manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(context))
  else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(context))
 }
 fun cancel(context:Context){
  context.getSystemService(AlarmManager::class.java).cancel(pending(context))
  context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove(DEADLINE).apply()
 }
 fun notifyFinished(context:Context){
  if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
  val manager=context.getSystemService(NotificationManager::class.java)
  val channel=NotificationChannel(CHANNEL,"Окончание отдыха",NotificationManager.IMPORTANCE_HIGH).apply{description="Сигнал таймера между подходами";enableVibration(true)}
  manager.createNotificationChannel(channel)
  val open=PendingIntent.getActivity(context,42,Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  manager.notify(41,Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_stat_training).setColor(Color.rgb(203,242,123)).setContentTitle("Отдых закончен").setContentText("Можно переходить к следующему подходу.").setCategory(Notification.CATEGORY_ALARM).setContentIntent(open).setAutoCancel(true).build())
 }
}
class RestAlarmReceiver:BroadcastReceiver(){
 override fun onReceive(context:Context,intent:Intent){
  if(intent.action!="ru.mytraining.diary.REST_FINISHED")return
  val deadline=RestAlarm.deadline(context)
  if(deadline<=0)return
  // A replaced/cancelled PendingIntent must never finish a newer timer early.
  if(deadline>System.currentTimeMillis()+1000){RestAlarm.set(context,deadline);return}
  RestAlarm.cancel(context);RestAlarm.notifyFinished(context)
 }
}
