package com.amanguard.child

import android.app.Notification
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.amanguard.core.model.CommandTypes
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

object Scheduler {
    fun schedule(c: Context) {
        val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val wm = WorkManager.getInstance(c)
        wm.enqueueUniquePeriodicWork("sync", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(net).build())
        wm.enqueueUniquePeriodicWork("location", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<LocationWorker>(15, TimeUnit.MINUTES).setConstraints(net).build())
    }
    fun cancel(c: Context) { WorkManager.getInstance(c).cancelUniqueWork("sync"); WorkManager.getInstance(c).cancelUniqueWork("location") }
    fun runNow(c: Context, commandId: String) {
        WorkManager.getInstance(c).enqueue(
            OneTimeWorkRequestBuilder<CommandWorker>().setInputData(workDataOf("commandId" to commandId))
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST).build())
    }
}

class SyncWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    override suspend fun doWork(): Result {
        if (!ChildStore.isLinked(applicationContext)) return Result.success()
        return try {
            if (!Tasks.deviceStillActive(applicationContext)) return Result.success()
            Tasks.syncAll(applicationContext); Result.success()
        } catch (e: Exception) { Result.retry() }
    }
}

class LocationWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    override suspend fun doWork(): Result {
        if (!ChildStore.isLinked(applicationContext)) return Result.success()
        return try { Tasks.captureLocation(applicationContext, high = false, source = "periodic"); Result.success() }
        catch (e: IllegalStateException) { Result.success() }   // permission/GPS problem: visible in status, retrying will not help
        catch (e: Exception) { Result.retry() }
    }
}

/** Executes one parent command and reports the REAL result back (applied / failed / unsupported). */
class CommandWorker(private val c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    override suspend fun getForegroundInfo(): ForegroundInfo {
        val n: Notification = NotificationCompat.Builder(c, ChildApp.CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle(c.getString(R.string.notif_syncing)).setOngoing(true).build()
        return if (Build.VERSION.SDK_INT >= 29)
            ForegroundInfo(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else ForegroundInfo(7, n)
    }

    override suspend fun doWork(): Result {
        val id = inputData.getString("commandId") ?: return Result.failure()
        if (!ChildStore.isLinked(c)) return Result.failure()
        val ref = FirebaseFirestore.getInstance().document("families/${ChildStore.familyId(c)}/devices/${ChildStore.deviceId(c)}/commands/$id")
        suspend fun report(status: String, result: String) =
            ref.update(mapOf("status" to status, "result" to result, "updatedAt" to FieldValue.serverTimestamp())).await()
        return try {
            val type = ref.get().await().getString("type")
            report("received", "Received by device")
            when (type) {
                CommandTypes.LOCATION_REFRESH -> { Tasks.captureLocation(c, true, "command"); report("applied", "Location uploaded") }
                CommandTypes.PERMISSIONS_CHECK -> { Tasks.heartbeat(c); report("applied", "Permission status uploaded") }
                CommandTypes.SYNC_NOW -> { Tasks.syncAll(c); report("applied", "Sync completed") }
                CommandTypes.RULES_SYNC -> {
                    Tasks.syncRules(c)
                    val count = RulesStore.getBlockedPackages(c).size
                    report("applied", "Rules enforced: $count apps restricted, schedule active")
                }
                else -> report("unsupported", "Command not supported on this device: $type")
            }
            Result.success()
        } catch (e: Exception) {
            try { report("failed", e.message ?: e.javaClass.simpleName) } catch (ignored: Exception) {}
            Result.failure()
        }
    }
}
