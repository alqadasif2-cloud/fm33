package com.amanguard.parent

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.amanguard.core.data.AppCheck

class ParentApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppCheck.install(this, BuildConfig.DEBUG)
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel("alerts", getString(R.string.tab_alerts), NotificationManager.IMPORTANCE_HIGH))
    }
}
