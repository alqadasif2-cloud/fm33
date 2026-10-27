package com.amanguard.child

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ChildMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        saveToken(applicationContext, token)
    }
    override fun onMessageReceived(m: RemoteMessage) {
        if (!ChildStore.isLinked(this)) return
        // Only accept commands/sessions addressed to THIS device of THIS family.
        if (m.data["familyId"] != ChildStore.familyId(this) || m.data["deviceId"] != ChildStore.deviceId(this)) return

        when (m.data["kind"]) {
            "command" -> {
                m.data["commandId"]?.let { Scheduler.runNow(this, it) }
            }
            "live_session_request" -> {
                val sid = m.data["sessionId"] ?: return
                val type = m.data["type"] ?: "screen"
                val fid = ChildStore.familyId(this) ?: return
                val did = ChildStore.deviceId(this) ?: return

                if (type == "screen") {
                    val intent = android.content.Intent(this, ScreenCaptureConsentActivity::class.java).apply {
                        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(ScreenCaptureConsentActivity.EXTRA_SESSION_ID, sid)
                        putExtra(ScreenCaptureConsentActivity.EXTRA_FAMILY_ID, fid)
                        putExtra(ScreenCaptureConsentActivity.EXTRA_DEVICE_ID, did)
                    }
                    startActivity(intent)
                } else {
                    val serviceIntent = android.content.Intent(this, LiveSessionService::class.java).apply {
                        action = if (type == "mic") LiveSessionService.ACTION_START_MIC else LiveSessionService.ACTION_START_CAMERA
                        putExtra(LiveSessionService.EXTRA_SESSION_ID, sid)
                        putExtra(LiveSessionService.EXTRA_FAMILY_ID, fid)
                        putExtra(LiveSessionService.EXTRA_DEVICE_ID, did)
                        if (type.startsWith("camera")) {
                            putExtra(LiveSessionService.EXTRA_CAMERA_FACING, if (type == "camera_back") "back" else "front")
                        }
                    }
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }
                }
            }
            "live_session_stop" -> {
                val stopIntent = android.content.Intent(this, LiveSessionService::class.java).apply {
                    action = LiveSessionService.ACTION_STOP
                }
                startService(stopIntent)
            }
        }
    }
    companion object {
        fun saveToken(c: android.content.Context, token: String) {
            if (!ChildStore.isLinked(c)) return
            FirebaseFirestore.getInstance().document("families/${ChildStore.familyId(c)}/devices/${ChildStore.deviceId(c)}")
                .update("fcmToken", token)
        }
    }
}
