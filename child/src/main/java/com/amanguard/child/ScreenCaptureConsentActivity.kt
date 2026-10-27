package com.amanguard.child

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

/**
 * Transparent activity that requests user consent for MediaProjection screen capture.
 * Required by Android: MediaProjectionManager.createScreenCaptureIntent() must be launched from an Activity.
 * Strictly compliant with Android 14+ lifecycle requirements.
 */
class ScreenCaptureConsentActivity : ComponentActivity() {

    companion object {
        const val EXTRA_SESSION_ID = "extra_session_id"
        const val EXTRA_FAMILY_ID = "extra_family_id"
        const val EXTRA_DEVICE_ID = "extra_device_id"
        private const val TAG = "ScreenCaptureConsent"
    }

    private var sessionId: String? = null
    private var familyId: String? = null
    private var deviceId: String? = null

    private val captureLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val sid = sessionId
        val fid = familyId
        val did = deviceId

        if (result.resultCode == Activity.RESULT_OK && result.data != null && sid != null && fid != null && did != null) {
            Log.i(TAG, "Screen capture consent GRANTED by user for session $sid")
            
            // Start the foreground LiveSessionService immediately with the consent intent
            val serviceIntent = Intent(this, LiveSessionService::class.java).apply {
                action = LiveSessionService.ACTION_START_SCREEN
                putExtra(LiveSessionService.EXTRA_SESSION_ID, sid)
                putExtra(LiveSessionService.EXTRA_FAMILY_ID, fid)
                putExtra(LiveSessionService.EXTRA_DEVICE_ID, did)
                putExtra(LiveSessionService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(LiveSessionService.EXTRA_RESULT_DATA, result.data)
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } else {
            Log.w(TAG, "Screen capture consent REJECTED or canceled by user")
            if (sid != null && fid != null && did != null) {
                FirebaseFirestore.getInstance()
                    .document("families/$fid/devices/$did/liveSessions/$sid")
                    .update(mapOf(
                        "status" to "rejected",
                        "failureReason" to "تم رفض إذن التقاط الشاشة من قبل المستخدم على الجهاز",
                        "updatedAt" to FieldValue.serverTimestamp(),
                        "endedAt" to FieldValue.serverTimestamp()
                    ))
            }
        }
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
        familyId = intent.getStringExtra(EXTRA_FAMILY_ID)
        deviceId = intent.getStringExtra(EXTRA_DEVICE_ID)

        if (sessionId == null) {
            finish()
            return
        }

        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val intent = projectionManager.createScreenCaptureIntent()
        captureLauncher.launch(intent)
    }
}
