package com.amanguard.child

import android.annotation.SuppressLint
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import com.amanguard.core.model.PermId
import com.amanguard.core.model.PermState
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** Real work done on the child device. Every function reports its true outcome (throws on failure). */
object Tasks {
    private fun dev(c: Context) = FirebaseFirestore.getInstance()
        .document("families/${ChildStore.familyId(c)}/devices/${ChildStore.deviceId(c)}")

    private fun repo(c: Context) = (c.applicationContext as ChildApp).permRepo

    /** Returns false (and unlinks locally) if the parent/device unlinked this device. */
    suspend fun deviceStillActive(c: Context): Boolean {
        val s = dev(c).get().await()
        val active = s.exists() && s.getString("status") == "active"
        if (!active) { ChildStore.clear(c); Scheduler.cancel(c) }
        return active
    }

    suspend fun heartbeat(c: Context) {
        repo(c).publish(ChildStore.familyId(c)!!, ChildStore.deviceId(c)!!)
        val bm = c.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val info = repo(c).state.value.associate { it.id.key to it.state.name }
        dev(c).collection("status").document("current").set(mapOf(
            "lastSeen" to FieldValue.serverTimestamp(),
            "battery" to bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY),
            "charging" to bm.isCharging,
            "androidSdk" to Build.VERSION.SDK_INT,
            "manufacturer" to Build.MANUFACTURER, "model" to Build.MODEL,
            "usageAccess" to (info[PermId.USAGE_ACCESS.key] == PermState.GRANTED.name),
            "locationReady" to (info[PermId.LOCATION_FINE.key] == PermState.GRANTED.name && info[PermId.LOCATION_SERVICES.key] == PermState.GRANTED.name),
        ), com.google.firebase.firestore.SetOptions.merge()).await()
        ChildStore.setLastSync(c, System.currentTimeMillis())
    }

    @SuppressLint("MissingPermission")
    suspend fun captureLocation(c: Context, high: Boolean, source: String) {
        val r = repo(c); r.refresh()
        val st = r.state.value.associate { it.id to it.state }
        fun fail(msg: String): Nothing {
            throw IllegalStateException(msg)
        }
        if (st[PermId.LOCATION_FINE] != PermState.GRANTED) fail("Precise location permission is not granted")
        if (st[PermId.LOCATION_SERVICES] != PermState.GRANTED) fail("Device location switch is off")
        if (st[PermId.LOCATION_BACKGROUND] != PermState.GRANTED) fail("Background location is not allowed (choose 'Allow all the time')")
        val client = LocationServices.getFusedLocationProviderClient(c)
        val loc = client.getCurrentLocation(
            if (high) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            CancellationTokenSource().token
        ).await() ?: fail("No location fix available (weak GPS signal?)")
        dev(c).collection("locations").add(mapOf(
            "lat" to loc.latitude, "lng" to loc.longitude, "accuracy" to loc.accuracy.toDouble(),
            "provider" to (loc.provider ?: "fused"), "deviceTime" to loc.time, "source" to source,
            "serverTime" to FieldValue.serverTimestamp(),
        )).await()
    }

    suspend fun syncUsage(c: Context) {
        if (repo(c).manager.check(PermId.USAGE_ACCESS) != PermState.GRANTED) return   // no usage data is invented
        val usm = c.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        for (back in 0..6) {
            val start = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -back); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
            val end = if (back == 0) System.currentTimeMillis() else start.timeInMillis + 86_400_000L
            val stats = usm.queryAndAggregateUsageStats(start.timeInMillis, end)
            val apps = stats.values.filter { it.totalTimeInForeground > 0 }
                .sortedByDescending { it.totalTimeInForeground }.take(60)
                .map { mapOf("pkg" to it.packageName, "seconds" to it.totalTimeInForeground / 1000) }
            val total = stats.values.sumOf { it.totalTimeInForeground } / 1000
            dev(c).collection("usage").document(fmt.format(Date(start.timeInMillis))).set(mapOf(
                "apps" to apps, "totalSeconds" to total, "updatedAt" to FieldValue.serverTimestamp(),
            )).await()
        }
    }

    suspend fun syncInventory(c: Context) {
        val pm = c.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(intent, 0).distinctBy { it.activityInfo.packageName }.take(400).map {
            val pkg = it.activityInfo.packageName
            val pi = try { pm.getPackageInfo(pkg, 0) } catch (e: PackageManager.NameNotFoundException) { null }
            mapOf("pkg" to pkg, "name" to it.loadLabel(pm).toString(), "installedAt" to (pi?.firstInstallTime ?: 0L), "updatedAt" to (pi?.lastUpdateTime ?: 0L))
        }
        dev(c).collection("inventory").document("current").set(mapOf(
            "apps" to apps, "complete" to false, // Android package visibility: only launcher apps are visible
            "updatedAt" to FieldValue.serverTimestamp(),
        )).await()
    }

    suspend fun syncRules(c: Context) {
        val snap = dev(c).collection("rules").document("current").get().await()
        if (snap.exists()) {
            @Suppress("UNCHECKED_CAST")
            val blocked = (snap.get("blockedPackages") as? List<String>)?.toSet() ?: emptySet()
            val bedtimeStart = snap.getString("bedtimeStart")
            val bedtimeEnd = snap.getString("bedtimeEnd")
            val dailyLimit = snap.getLong("dailyLimitMin")?.toInt() ?: 0
            @Suppress("UNCHECKED_CAST")
            val appLimits = (snap.get("appLimits") as? Map<String, Number>)
                ?.mapValues { it.value.toInt() } ?: emptyMap()

            RulesStore.saveRules(c, blocked, bedtimeStart, bedtimeEnd, dailyLimit, appLimits)
        }
    }

    suspend fun syncAll(c: Context) { heartbeat(c); syncUsage(c); syncInventory(c); syncRules(c) }
}
