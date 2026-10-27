package com.amanguard.parent

import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ParentMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) { register(token) }

    override fun onMessageReceived(m: RemoteMessage) {
        if (m.data["kind"] != "alert") return
        val n = NotificationCompat.Builder(this, "alerts")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(m.data["title"]).setContentText(m.data["body"]).setAutoCancel(true).build()
        getSystemService(NotificationManager::class.java).notify((m.data["alertId"] ?: "x").hashCode(), n)
    }

    companion object {
        /** Registers/refreshes this phone's FCM token on the signed-in parent's user doc. */
        fun register(token: String) {
            val u = FirebaseAuth.getInstance().currentUser ?: return
            FirebaseFirestore.getInstance().document("users/${u.uid}").update("fcmTokens", FieldValue.arrayUnion(token))
        }
    }
}
