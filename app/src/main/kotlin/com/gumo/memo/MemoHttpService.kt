package com.gumo.memo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

class MemoHttpService : Service() {

    private var server: MemoHttpServer? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(2, buildNotif())
        server = MemoHttpServer(DatabaseHelper(this), this).also {
            try {
                it.start()
                Log.d("MemoHttp", "started :8081")
            } catch (e: Exception) {
                Log.e("MemoHttp", "start failed: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        server?.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int = START_STICKY

    private fun createChannel() {
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(
                NotificationChannel("memo_http", "구모메모 HTTP", NotificationManager.IMPORTANCE_MIN)
            )
    }

    private fun buildNotif(): Notification =
        Notification.Builder(this, "memo_http")
            .setContentTitle("구모메모 HTTP :8081")
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .build()
}
