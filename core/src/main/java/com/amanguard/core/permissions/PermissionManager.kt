package com.amanguard.core.permissions

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.amanguard.core.model.PermId
import com.amanguard.core.model.PermInfo
import com.amanguard.core.model.PermState

class PermissionManager(private val ctx: Context) {
    private val prefs = ctx.getSharedPreferences("aman_perms", Context.MODE_PRIVATE)

    fun markRequested(id: PermId) = prefs.edit().putBoolean("req_${id.key}", true).apply()
    private fun requested(id: PermId) = prefs.getBoolean("req_${id.key}", false)
    private fun everGranted(id: PermId) = prefs.getBoolean("ok_${id.key}", false)
    private fun has(p: String) = ContextCompat.checkSelfPermission(ctx, p) == PackageManager.PERMISSION_GRANTED

    fun runtimePermissions(id: PermId): Array<String> = when (id) {
        PermId.LOCATION_FINE -> arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        PermId.LOCATION_BACKGROUND -> if (Build.VERSION.SDK_INT >= 29) arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION) else emptyArray()
        PermId.NOTIFICATIONS -> if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()
        PermId.CAMERA -> arrayOf(Manifest.permission.CAMERA)
        PermId.MICROPHONE -> arrayOf(Manifest.permission.RECORD_AUDIO)
        else -> emptyArray()
    }

    /** True when Android only allows enabling this from a Settings page. */
    fun needsSettings(id: PermId): Boolean = when (id) {
        PermId.LOCATION_BACKGROUND -> Build.VERSION.SDK_INT >= 30
        PermId.NOTIFICATIONS -> Build.VERSION.SDK_INT < 33
        PermId.LOCATION_SERVICES, PermId.USAGE_ACCESS, PermId.BATTERY_OPT -> true
        else -> false
    }

    fun check(id: PermId): PermState {
        var partial = false
        val granted = when (id) {
            PermId.LOCATION_FINE -> { val f = has(Manifest.permission.ACCESS_FINE_LOCATION); partial = !f && has(Manifest.permission.ACCESS_COARSE_LOCATION); f }
            PermId.LOCATION_BACKGROUND ->
                if (Build.VERSION.SDK_INT >= 29) has(Manifest.permission.ACCESS_BACKGROUND_LOCATION) else has(Manifest.permission.ACCESS_FINE_LOCATION)
            PermId.LOCATION_SERVICES -> LocationManagerCompat.isLocationEnabled(ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager)
            PermId.NOTIFICATIONS -> NotificationManagerCompat.from(ctx).areNotificationsEnabled()
            PermId.USAGE_ACCESS -> usageGranted()
            PermId.BATTERY_OPT -> (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(ctx.packageName)
            PermId.CAMERA -> has(Manifest.permission.CAMERA)
            PermId.MICROPHONE -> has(Manifest.permission.RECORD_AUDIO)
        }
        if (granted) prefs.edit().putBoolean("ok_${id.key}", true).apply()
        return PermissionLogic.resolve(granted, partial, requested(id), everGranted(id), needsSettings(id))
    }

    fun checkAll(ids: List<PermId>, now: Long = System.currentTimeMillis()) = ids.map { PermInfo(it, check(it), now) }

    @Suppress("DEPRECATION")
    private fun usageGranted(): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29)
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        else ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return if (mode == AppOpsManager.MODE_DEFAULT)
            ctx.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
        else mode == AppOpsManager.MODE_ALLOWED
    }

    fun settingsIntent(id: PermId): Intent = when (id) {
        PermId.LOCATION_SERVICES -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        PermId.USAGE_ACCESS -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        PermId.BATTERY_OPT -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        PermId.NOTIFICATIONS -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))
    }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
