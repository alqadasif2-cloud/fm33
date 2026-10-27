package com.amanguard.child

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.amanguard.core.data.AppCheck
import com.amanguard.core.model.PermId
import com.amanguard.core.permissions.PermissionManager
import com.amanguard.core.permissions.PermissionStatusRepository

class ChildApp : Application() {
    lateinit var permRepo: PermissionStatusRepository
    override fun onCreate() {
        super.onCreate()
        AppCheck.install(this, BuildConfig.DEBUG)
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW))
        permRepo = PermissionStatusRepository(PermissionManager(this), REQUIRED)
        if (ChildStore.isLinked(this)) Scheduler.schedule(this)
    }
    companion object {
        const val CHANNEL = "sync_status"
        /** Permissions required by the features implemented in this version. */
        val REQUIRED = listOf(PermId.NOTIFICATIONS, PermId.LOCATION_FINE, PermId.LOCATION_SERVICES, PermId.LOCATION_BACKGROUND, PermId.USAGE_ACCESS, PermId.BATTERY_OPT)
    }
}
