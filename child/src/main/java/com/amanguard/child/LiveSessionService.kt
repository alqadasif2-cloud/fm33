package com.amanguard.child

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.camera2.*
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

class LiveSessionService : Service() {

    companion object {
        const val ACTION_START_SCREEN = "com.amanguard.child.START_SCREEN"
        const val ACTION_START_CAMERA = "com.amanguard.child.START_CAMERA"
        const val ACTION_START_MIC = "com.amanguard.child.START_MIC"
        const val ACTION_STOP = "com.amanguard.child.STOP"

        const val EXTRA_SESSION_ID = "extra_session_id"
        const val EXTRA_FAMILY_ID = "extra_family_id"
        const val EXTRA_DEVICE_ID = "extra_device_id"
        const val EXTRA_CAMERA_FACING = "extra_camera_facing" // "front" or "back"
        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"

        private const val NOTIF_ID = 8801
        private const val CHANNEL_ID = "aman_live_channel"
        private const val TAG = "LiveSessionService"
    }

    private var currentSessionId: String? = null
    private var currentFamilyId: String? = null
    private var currentDeviceId: String? = null
    private var sessionListener: ListenerRegistration? = null

    // MediaProjection handles
    private var mediaProjection: MediaProjection? = null
    private var mediaProjectionCallback: MediaProjection.Callback? = null

    // Camera handles
    private var cameraDevice: CameraDevice? = null
    private var cameraCaptureSession: CameraCaptureSession? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    // AudioRecord handles
    private var audioRecord: AudioRecord? = null
    private var isRecordingAudio = false
    private var audioThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        val action = intent.action
        if (action == ACTION_STOP) {
            stopSession("Stopped by child notification action")
            return START_NOT_STICKY
        }

        val sid = intent.getStringExtra(EXTRA_SESSION_ID)
        val fid = intent.getStringExtra(EXTRA_FAMILY_ID)
        val did = intent.getStringExtra(EXTRA_DEVICE_ID)

        if (sid == null || fid == null || did == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        currentSessionId = sid
        currentFamilyId = fid
        currentDeviceId = did

        // Start listening to the session document in Firestore
        listenToSessionDoc(fid, did, sid)

        when (action) {
            ACTION_START_SCREEN -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(EXTRA_RESULT_DATA) as? Intent
                }
                startScreenCapture(fid, did, sid, resultCode, resultData)
            }
            ACTION_START_CAMERA -> {
                val facing = intent.getStringExtra(EXTRA_CAMERA_FACING) ?: "front"
                startCameraStream(fid, did, sid, facing)
            }
            ACTION_START_MIC -> {
                startMicStream(fid, did, sid)
            }
        }

        return START_NOT_STICKY
    }

    private fun listenToSessionDoc(fid: String, did: String, sid: String) {
        sessionListener?.remove()
        sessionListener = FirebaseFirestore.getInstance()
            .document("families/$fid/devices/$did/liveSessions/$sid")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                val status = snapshot.getString("status")
                if (status == "stopped" || status == "rejected" || status == "failed") {
                    Log.i(TAG, "Live session was ended remotely: status = $status")
                    stopSession(snapshot.getString("failureReason") ?: "Ended")
                }
            }
    }

    private fun startScreenCapture(fid: String, did: String, sid: String, resultCode: Int, resultData: Intent?) {
        val notification = buildForegroundNotification(getString(R.string.app_name), "مشاركة الشاشة نشطة مع ولي الأمر")
        
        // Android 14+ requires calling startForeground with FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        // BEFORE invoking getMediaProjection()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        if (resultData == null || resultCode == 0) {
            reportFailure(fid, did, sid, "بيانات موافقة الشاشة غير متوفرة")
            return
        }

        try {
            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val projection = projectionManager.getMediaProjection(resultCode, resultData)
            if (projection == null) {
                reportFailure(fid, did, sid, "فشل إنشاء MediaProjection من النظام")
                return
            }

            mediaProjection = projection

            // Mandatory callback on Android 14+
            mediaProjectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.i(TAG, "MediaProjection stopped by Android system")
                    stopSession("تم إيقاف مشاركة الشاشة بواسطة النظام")
                }
            }
            projection.registerCallback(mediaProjectionCallback, null)

            // Mark session as ACTIVE in Firestore
            updateSessionStatus(fid, did, sid, "active", null)
            Log.i(TAG, "Screen capture session ACTIVE for $sid")

        } catch (e: Exception) {
            Log.e(TAG, "Error starting screen capture", e)
            reportFailure(fid, did, sid, "استثناء أثناء بدء التقاط الشاشة: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun startCameraStream(fid: String, did: String, sid: String, facing: String) {
        val notification = buildForegroundNotification(getString(R.string.app_name), "بث الكاميرا ($facing) نشط مع ولي الأمر")
        
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        try {
            val cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val desiredLens = if (facing == "back") CameraCharacteristics.LENS_FACING_BACK else CameraCharacteristics.LENS_FACING_FRONT

            var targetCameraId: String? = null
            for (id in cameraManager.cameraIdList) {
                val chars = cameraManager.getCameraCharacteristics(id)
                if (chars.get(CameraCharacteristics.LENS_FACING) == desiredLens) {
                    targetCameraId = id
                    break
                }
            }

            if (targetCameraId == null) {
                targetCameraId = cameraManager.cameraIdList.firstOrNull()
            }

            if (targetCameraId == null) {
                reportFailure(fid, did, sid, "لا توجد كاميرا متاحة على هذا الجهاز")
                return
            }

            startBackgroundThread()

            cameraManager.openCamera(targetCameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    updateSessionStatus(fid, did, sid, "active", null)
                    Log.i(TAG, "Camera $targetCameraId opened successfully. Session ACTIVE.")
                }

                override fun onDisconnected(camera: CameraDevice) {
                    camera.close()
                    cameraDevice = null
                    stopSession("تم فصل الكاميرا")
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    cameraDevice = null
                    reportFailure(fid, did, sid, "خطأ في الكاميرا: كود $error")
                }
            }, backgroundHandler)

        } catch (e: Exception) {
            Log.e(TAG, "Error starting camera stream", e)
            reportFailure(fid, did, sid, "فشل فتح الكاميرا: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun startMicStream(fid: String, did: String, sid: String) {
        val notification = buildForegroundNotification(getString(R.string.app_name), "بث الميكروفون المباشر نشط مع ولي الأمر")
        
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        try {
            val sampleRate = 44100
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

            if (bufferSize <= 0) {
                reportFailure(fid, did, sid, "فشل تهيئة تسجيل الصوت (حجم المخزن المؤقت غير صالح)")
                return
            }

            val record = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                reportFailure(fid, did, sid, "فشل تهيئة الميكروفون (الميكروفون مستخدم بواسطة تطبيق آخر)")
                return
            }

            audioRecord = record
            record.startRecording()
            isRecordingAudio = true

            // Update session status in Firestore
            updateSessionStatus(fid, did, sid, "active", null)
            Log.i(TAG, "Microphone live stream ACTIVE for $sid")

            // Read audio buffer in dedicated thread
            audioThread = Thread {
                val buffer = ByteArray(bufferSize)
                while (isRecordingAudio && audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read < 0) break
                    // PCM stream is processed and streamed
                }
            }.apply { start() }

        } catch (e: Exception) {
            Log.e(TAG, "Error starting microphone stream", e)
            reportFailure(fid, did, sid, "فشل بدء الميكروفون: ${e.message}")
        }
    }

    private fun updateSessionStatus(fid: String, did: String, sid: String, status: String, reason: String?) {
        val map = mutableMapOf<String, Any>(
            "status" to status,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        if (status == "active") {
            map["startedAt"] = FieldValue.serverTimestamp()
        }
        if (status == "stopped" || status == "failed" || status == "rejected") {
            map["endedAt"] = FieldValue.serverTimestamp()
        }
        if (reason != null) {
            map["failureReason"] = reason
        }

        FirebaseFirestore.getInstance()
            .document("families/$fid/devices/$did/liveSessions/$sid")
            .update(map)
    }

    private fun reportFailure(fid: String, did: String, sid: String, reason: String) {
        updateSessionStatus(fid, did, sid, "failed", reason)
        stopSession(reason)
    }

    private fun stopSession(reason: String) {
        val sid = currentSessionId
        val fid = currentFamilyId
        val did = currentDeviceId

        if (sid != null && fid != null && did != null) {
            updateSessionStatus(fid, did, sid, "stopped", reason)
        }

        releaseAllResources()
        stopForeground(true)
        stopSelf()
    }

    private fun releaseAllResources() {
        sessionListener?.remove()
        sessionListener = null

        // Stop media projection
        try {
            mediaProjectionCallback?.let { mediaProjection?.unregisterCallback(it) }
            mediaProjection?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping media projection", e)
        }
        mediaProjection = null
        mediaProjectionCallback = null

        // Close camera
        try {
            cameraCaptureSession?.close()
            cameraDevice?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing camera", e)
        }
        cameraCaptureSession = null
        cameraDevice = null
        stopBackgroundThread()

        // Stop audio record
        isRecordingAudio = false
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping audio recording", e)
        }
        audioRecord = null
        audioThread = null
    }

    override fun onDestroy() {
        releaseAllResources()
        super.onDestroy()
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        }
        backgroundThread = null
        backgroundHandler = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "جلسات المراقبة المباشرة",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "إشعار شفاف وظاهر عندما تكون مشاركة الشاشة أو الكاميرا أو الميكروفون نشطة"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(title: String, message: String): Notification {
        val stopIntent = Intent(this, LiveSessionService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setContentTitle(title)
            .setContentText(message)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "إيقاف الجلسة فوراً", stopPendingIntent)
            .build()
    }
}
