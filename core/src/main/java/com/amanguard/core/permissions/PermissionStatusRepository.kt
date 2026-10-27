package com.amanguard.core.permissions

import com.amanguard.core.model.PermId
import com.amanguard.core.model.PermInfo
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

class PermissionStatusRepository(val manager: PermissionManager, val ids: List<PermId>) {
    private val _state = MutableStateFlow(manager.checkAll(ids))
    val state: StateFlow<List<PermInfo>> = _state.asStateFlow()

    fun refresh(): List<PermInfo> = manager.checkAll(ids).also { _state.value = it }

    /** Child device publishes its REAL state; parent only reads it. */
    suspend fun publish(familyId: String, deviceId: String) {
        val items = refresh().associate { it.id.key to mapOf("state" to it.state.name, "checkedAt" to it.checkedAt) }
        FirebaseFirestore.getInstance().document("families/$familyId/devices/$deviceId/permissions/current")
            .set(mapOf("items" to items, "updatedAt" to FieldValue.serverTimestamp())).await()
    }
}
