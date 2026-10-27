package com.amanguard.parent

import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

/** Thin wrappers over the Cloud Functions; authorization is enforced server-side. */
object Backend {
    private val fn: FirebaseFunctions get() = FirebaseFunctions.getInstance()
    @Suppress("UNCHECKED_CAST")
    private suspend fun call(name: String, data: Map<String, Any?>): Map<String, Any?> =
        (fn.getHttpsCallable(name).call(data).await().data as? Map<String, Any?>) ?: emptyMap()

    suspend fun ensureFamily(): String = call("ensureFamily", emptyMap())["familyId"] as String
    suspend fun createCode(familyId: String, childName: String): String =
        call("createPairingCode", mapOf("familyId" to familyId, "childName" to childName))["code"] as String
    suspend fun sendCommand(familyId: String, deviceId: String, type: String) =
        call("sendCommand", mapOf("familyId" to familyId, "deviceId" to deviceId, "type" to type))
    suspend fun unlink(familyId: String, deviceId: String) =
        call("unlinkDevice", mapOf("familyId" to familyId, "deviceId" to deviceId))

    suspend fun requestLiveSession(familyId: String, deviceId: String, type: String): String =
        call("requestLiveSession", mapOf("familyId" to familyId, "deviceId" to deviceId, "type" to type))["sessionId"] as String

    suspend fun stopLiveSession(familyId: String, deviceId: String, sessionId: String) =
        call("stopLiveSession", mapOf("familyId" to familyId, "deviceId" to deviceId, "sessionId" to sessionId))
}
