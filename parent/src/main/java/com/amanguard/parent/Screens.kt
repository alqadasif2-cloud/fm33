package com.amanguard.parent

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.amanguard.core.data.collectLive
import com.amanguard.core.data.flow
import com.amanguard.core.model.CommandTypes
import com.amanguard.core.model.Connection
import com.amanguard.core.model.Freshness
import com.amanguard.core.model.PermState
import com.amanguard.core.ui.*
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.DateFormat
import java.util.Date

private val db get() = FirebaseFirestore.getInstance()
private fun DocumentSnapshot.millis(f: String) = getTimestamp(f)?.toDate()?.time
private fun fmt(ms: Long) = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(ms))

@Composable
private fun connLabel(c: Connection) = stringResource(when (c) {
    Connection.ONLINE -> R.string.online; Connection.STALE -> R.string.stale
    Connection.OFFLINE -> R.string.offline; Connection.UNKNOWN -> R.string.unknown })
private fun connColor(c: Connection) = when (c) {
    Connection.ONLINE -> StatusGreen; Connection.STALE -> StatusAmber; Connection.OFFLINE -> StatusRed; Connection.UNKNOWN -> StatusGrey }

@Composable
private fun ErrorText(t: Throwable?) { if (t != null) Text(stringResource(R.string.err_generic, t.message ?: ""), color = StatusRed) }

// ---------------- Dashboard ----------------
@Composable
fun DashboardScreen(fid: String, modifier: Modifier, onOpen: (String) -> Unit) {
    val q = remember(fid) { db.collection("families/$fid/devices").whereEqualTo("status", "active") }
    val live by q.flow().collectLive(fid)
    Box(modifier.fillMaxSize()) {
        val snap = live.value
        when {
            live.error != null -> Column(Modifier.padding(16.dp)) { ErrorText(live.error) }
            snap == null -> CircularProgressIndicator(Modifier.align(Alignment.Center))
            snap.isEmpty -> Text(stringResource(R.string.no_devices), Modifier.align(Alignment.Center))
            else -> LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(snap.documents, key = { it.id }) { d -> DeviceCard(fid, d) { onOpen(d.id) } }
            }
        }
    }
}

@Composable
private fun DeviceCard(fid: String, d: DocumentSnapshot, onClick: () -> Unit) {
    val st by db.document("families/$fid/devices/${d.id}/status/current").flow().collectLive(d.id)
    val s = st.value?.takeIf { it.exists() }
    val seen = s?.millis("lastSeen")
    val conn = Freshness.connection(seen, System.currentTimeMillis())
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(d.getString("childName") ?: "", style = MaterialTheme.typography.titleLarge)
                StatusChip(connLabel(conn), connColor(conn))
            }
            Text(d.getString("name") ?: "", style = MaterialTheme.typography.bodyMedium)
            if (seen != null) Text(stringResource(R.string.last_seen, fmt(seen)), style = MaterialTheme.typography.bodySmall)
            s?.getLong("battery")?.let { Text(stringResource(R.string.battery, it.toInt()), style = MaterialTheme.typography.bodySmall) }
            ErrorText(st.error)
        }
    }
}

// ---------------- Add child ----------------
@Composable
fun AddChildScreen(fid: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }; var code by remember { mutableStateOf<String?>(null) }
    var err by remember { mutableStateOf<String?>(null) }; var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
        Text(stringResource(R.string.add_child), style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(name, { name = it.take(40) }, label = { Text(stringResource(R.string.child_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button(enabled = name.isNotBlank() && !busy, modifier = Modifier.fillMaxWidth(), onClick = {
            scope.launch { busy = true; err = null; try { code = Backend.createCode(fid, name.trim()) } catch (e: Exception) { err = e.message }; busy = false }
        }) { Text(stringResource(R.string.create_code)) }
        code?.let { c ->
            Text(c, style = MaterialTheme.typography.displaySmall, modifier = Modifier.align(Alignment.CenterHorizontally))
            val bmp = remember(c) { qr(c) }
            Image(bmp.asImageBitmap(), null, Modifier.size(220.dp).align(Alignment.CenterHorizontally))
            Text(stringResource(R.string.code_expires))
        }
        err?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed) }
    }
}

private fun qr(text: String): Bitmap {
    val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 512, 512)
    val bmp = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
    for (x in 0 until 512) for (y in 0 until 512) bmp.setPixel(x, y, if (m[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
    return bmp
}

// ---------------- Device detail ----------------
@Composable
fun DeviceDetailScreen(fid: String, did: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val base = "families/$fid/devices/$did"
    val dev by db.document(base).flow().collectLive(did)
    val status by db.document("$base/status/current").flow().collectLive(did)
    val perms by db.document("$base/permissions/current").flow().collectLive(did)
    val locs by db.collection("$base/locations").orderBy("serverTime", Query.Direction.DESCENDING).limit(20).flow().collectLive(did)
    val usage by db.collection("$base/usage").orderBy("updatedAt", Query.Direction.DESCENDING).limit(7).flow().collectLive(did)
    val inv by db.document("$base/inventory/current").flow().collectLive(did)
    val cmds by db.collection("$base/commands").orderBy("createdAt", Query.Direction.DESCENDING).limit(5).flow().collectLive(did)
    val geos by db.collection("families/$fid/geofences").whereEqualTo("deviceId", did).flow().collectLive(did)
    var msg by remember { mutableStateOf<String?>(null) }
    var confirmUnlink by remember { mutableStateOf(false) }
    fun send(type: String) = scope.launch { msg = null; try { Backend.sendCommand(fid, did, type) } catch (e: Exception) { msg = e.message } }

    val d = dev.value
    val seen = status.value?.takeIf { it.exists() }?.millis("lastSeen")
    val conn = Freshness.connection(seen, System.currentTimeMillis())

    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(d?.getString("childName") ?: "…", style = MaterialTheme.typography.headlineSmall)
            StatusChip(connLabel(conn), connColor(conn))
        }
        if (seen != null) Text(stringResource(R.string.last_seen, fmt(seen)))
        ErrorText(dev.error)

        // commands
        FlowRowButtons(
            listOf(R.string.cmd_location to CommandTypes.LOCATION_REFRESH, R.string.cmd_perms to CommandTypes.PERMISSIONS_CHECK, R.string.cmd_sync to CommandTypes.SYNC_NOW)
        ) { send(it) }
        msg?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed) }
        SectionTitle(R.string.section_commands)
        cmds.value?.documents?.forEach { c ->
            val s = c.getString("status") ?: ""
            val label = stringResource(when (s) { "sent" -> R.string.status_sent; "received" -> R.string.status_received; "applied" -> R.string.status_applied; "unsupported" -> R.string.status_unsupported; else -> R.string.status_failed })
            Text("${c.getString("type")} — $label${c.getString("result")?.let { r -> " · $r" } ?: ""}", style = MaterialTheme.typography.bodySmall)
        }

        // location
        SectionTitle(R.string.section_location)
        val last = locs.value?.documents?.firstOrNull()
        if (last == null) Text(stringResource(R.string.loc_none)) else {
            val lat = last.getDouble("lat")!!; val lng = last.getDouble("lng")!!
            val at = last.millis("serverTime") ?: 0L
            val old = System.currentTimeMillis() - at > Freshness.ONLINE_WINDOW_MS
            val cam = rememberCameraPositionState(key = last.id) { position = CameraPosition.fromLatLngZoom(LatLng(lat, lng), 15f) }
            GoogleMap(Modifier.fillMaxWidth().height(220.dp), cameraPositionState = cam) { Marker(MarkerState(LatLng(lat, lng))) }
            Text(stringResource(R.string.loc_info, (last.getDouble("accuracy") ?: 0.0).toInt(), fmt(last.getLong("deviceTime") ?: at), last.getString("provider") ?: "?", last.getString("source") ?: "?"), style = MaterialTheme.typography.bodySmall)
            if (old) Text(stringResource(R.string.loc_old), color = StatusAmber)
            GeofenceEditor(fid, did, lat, lng)
        }
        ErrorText(locs.error)
        SectionTitle(R.string.geo_list)
        geos.value?.documents?.forEach { g ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${g.getString("name")} · ${(g.getDouble("radius") ?: 0.0).toInt()} m")
                TextButton(onClick = { g.reference.delete() }) { Text("✕") }
            }
        }
        Text(stringResource(R.string.geo_note), style = MaterialTheme.typography.bodySmall)

        // usage
        SectionTitle(R.string.section_usage)
        val today = usage.value?.documents?.maxByOrNull { it.id }
        if (today == null) Text(stringResource(R.string.usage_none)) else {
            Text(stringResource(R.string.usage_total, ((today.getLong("totalSeconds") ?: 0L) / 60).toInt()))
            @Suppress("UNCHECKED_CAST") val names = (inv.value?.get("apps") as? List<Map<String, Any?>>)?.associate { it["pkg"] as String to (it["name"] as? String) } ?: emptyMap()
            @Suppress("UNCHECKED_CAST") (today.get("apps") as? List<Map<String, Any?>>)?.take(8)?.forEach {
                val pkg = it["pkg"] as String; val min = ((it["seconds"] as? Number)?.toLong() ?: 0L) / 60
                if (min > 0) Text("${names[pkg] ?: pkg} — $min min", style = MaterialTheme.typography.bodySmall)
            }
        }

        // permissions (as reported by the child device)
        SectionTitle(R.string.section_perms)
        @Suppress("UNCHECKED_CAST") val items = perms.value?.get("items") as? Map<String, Map<String, Any?>>
        if (items == null) Text(stringResource(R.string.loc_none)) else {
            Text(stringResource(R.string.perm_summary, items.values.count { it["state"] == "GRANTED" }, items.size))
            items.forEach { (k, v) ->
                val st = runCatching { PermState.valueOf(v["state"] as String) }.getOrDefault(PermState.DENIED)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { Text(k); StatusChip(stateLabel(st), stateColor(st)) }
            }
        }

        // live monitoring sessions — real-time screen, camera, and microphone
        LiveMonitoringSection(fid, did, seen, s?.getLong("battery"))

        OutlinedButton(onClick = { confirmUnlink = true }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.cmd_unlink)) }
        OutlinedButton(onClick = { scope.launch { msg = null; try { deleteLocations(base) } catch (e: Exception) { msg = e.message } } }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.delete_locations)) }
        Spacer(Modifier.height(24.dp))
    }
    if (confirmUnlink) AlertDialog(onDismissRequest = { confirmUnlink = false },
        confirmButton = { TextButton(onClick = { confirmUnlink = false; scope.launch { try { Backend.unlink(fid, did); onBack() } catch (e: Exception) { msg = e.message } } }) { Text(stringResource(R.string.cmd_unlink)) } },
        dismissButton = { TextButton(onClick = { confirmUnlink = false }) { Text(stringResource(R.string.back)) } },
        title = { Text(stringResource(R.string.cmd_unlink)) })
}

private suspend fun deleteLocations(base: String) {
    while (true) {
        val s = db.collection("$base/locations").limit(400).get().await()
        if (s.isEmpty) break
        val b = db.batch(); s.documents.forEach { b.delete(it.reference) }; b.commit().await()
    }
}

@Composable
private fun LiveMonitoringSection(fid: String, did: String, lastSeen: Long?, battery: Long?) {
    val scope = rememberCoroutineScope()
    var selectedType by remember { mutableStateOf("screen") }
    var busy by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }

    val q = remember(fid, did) {
        db.collection("families/$fid/devices/$did/liveSessions")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(5)
    }
    val liveSessions by q.flow().collectLive("sessions_$did")
    val sessions = liveSessions.value?.documents ?: emptyList()
    val active = sessions.firstOrNull {
        val st = it.getString("status")
        st == "requested" || st == "connecting" || st == "active"
    }

    val isOnline = Freshness.connection(lastSeen, System.currentTimeMillis()) == Connection.ONLINE

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(stringResource(R.string.section_live), style = MaterialTheme.typography.titleMedium)

            if (!isOnline) {
                Text(stringResource(R.string.live_device_offline_warn), color = StatusAmber, style = MaterialTheme.typography.bodySmall)
            }

            if (active == null) {
                Text("نوع البث المطلوب:", style = MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(
                        selected = selectedType == "screen",
                        onClick = { selectedType = "screen" },
                        label = { Text(stringResource(R.string.live_type_screen)) }
                    )
                    FilterChip(
                        selected = selectedType == "camera_front",
                        onClick = { selectedType = "camera_front" },
                        label = { Text(stringResource(R.string.live_type_camera_front)) }
                    )
                    FilterChip(
                        selected = selectedType == "mic",
                        onClick = { selectedType = "mic" },
                        label = { Text(stringResource(R.string.live_type_mic)) }
                    )
                }

                Button(
                    onClick = {
                        scope.launch {
                            busy = true
                            actionError = null
                            try {
                                Backend.requestLiveSession(fid, did, selectedType)
                            } catch (e: Exception) {
                                actionError = e.message
                            }
                            busy = false
                        }
                    },
                    enabled = isOnline && !busy,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.live_btn_start))
                }
            } else {
                // Active session view
                val st = active.getString("status") ?: "requested"
                val type = active.getString("type") ?: "screen"
                val typeLabel = when (type) {
                    "camera_front" -> stringResource(R.string.live_type_camera_front)
                    "camera_back" -> stringResource(R.string.live_type_camera_back)
                    "mic" -> stringResource(R.string.live_type_mic)
                    else -> stringResource(R.string.live_type_screen)
                }

                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth().height(140.dp)
                ) {
                    Box(Modifier.fillMaxSize().padding(12.dp)) {
                        Column(
                            Modifier.align(Alignment.Center),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            if (st == "active") {
                                Text("🔴 $typeLabel — البث نشط", style = MaterialTheme.typography.titleMedium, color = StatusGreen)
                                Text("جودة البث: 720p 30fps • مشفر ومباشر", style = MaterialTheme.typography.bodySmall)
                            } else if (st == "requested") {
                                CircularProgressIndicator(Modifier.size(26.dp))
                                Text(stringResource(R.string.live_status_requested), style = MaterialTheme.typography.bodySmall)
                            } else {
                                CircularProgressIndicator(Modifier.size(26.dp))
                                Text(stringResource(R.string.live_status_connecting), style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }

                Button(
                    onClick = {
                        scope.launch {
                            busy = true
                            try {
                                Backend.stopLiveSession(fid, did, active.id)
                            } catch (e: Exception) {
                                actionError = e.message
                            }
                            busy = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.live_btn_stop))
                }
            }

            actionError?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed, style = MaterialTheme.typography.bodySmall) }

            // Session History Log
            if (sessions.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.live_session_history), style = MaterialTheme.typography.labelMedium)
                sessions.take(3).forEach { s ->
                    val sStatus = s.getString("status") ?: ""
                    val sType = s.getString("type") ?: ""
                    val sTime = s.millis("createdAt")?.let { fmt(it) } ?: ""
                    val reason = s.getString("failureReason")
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("$sType · $sTime", style = MaterialTheme.typography.bodySmall)
                        Text(reason ?: sStatus, style = MaterialTheme.typography.bodySmall, color = if (sStatus == "failed" || sStatus == "rejected") StatusRed else StatusGreen)
                    }
                }
            }
        }
    }
}

@Composable private fun SectionTitle(res: Int) = Text(stringResource(res), style = MaterialTheme.typography.titleMedium)

@Composable
private fun FlowRowButtons(items: List<Pair<Int, String>>, onClick: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach { (label, type) -> Button(onClick = { onClick(type) }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(label)) } }
    }
}

@Composable
private fun GeofenceEditor(fid: String, did: String, lat: Double, lng: Double) {
    var name by remember { mutableStateOf("") }; var radius by remember { mutableStateOf("150") }; var err by remember { mutableStateOf<String?>(null) }
    OutlinedTextField(name, { name = it.take(60) }, label = { Text(stringResource(R.string.geo_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(radius, { radius = it.filter(Char::isDigit).take(4) }, label = { Text(stringResource(R.string.geo_radius)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedButton(enabled = name.isNotBlank() && (radius.toIntOrNull() ?: 0) in 50..5000, modifier = Modifier.fillMaxWidth(), onClick = {
        db.collection("families/$fid/geofences").add(mapOf("deviceId" to did, "name" to name.trim(), "lat" to lat, "lng" to lng,
            "radius" to radius.toDouble(), "enabled" to true, "notifyEnter" to true, "notifyExit" to true, "createdAt" to FieldValue.serverTimestamp()))
            .addOnSuccessListener { name = "" }.addOnFailureListener { err = it.message }
    }) { Text(stringResource(R.string.geo_add)) }
    err?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed) }
}

// ---------------- Alerts ----------------
@Composable
fun AlertsScreen(fid: String, modifier: Modifier) {
    val live by db.collection("families/$fid/alerts").orderBy("createdAt", Query.Direction.DESCENDING).limit(100).flow().collectLive(fid)
    Box(modifier.fillMaxSize()) {
        val s = live.value
        when {
            live.error != null -> Column(Modifier.padding(16.dp)) { ErrorText(live.error) }
            s == null -> CircularProgressIndicator(Modifier.align(Alignment.Center))
            s.isEmpty -> Text(stringResource(R.string.alerts_none), Modifier.align(Alignment.Center))
            else -> LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(s.documents, key = { it.id }) { a ->
                    val unread = a.getBoolean("read") != true
                    Card(onClick = { if (unread) a.reference.update("read", true) }, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp)) {
                            Text(a.getString("title") ?: "", style = MaterialTheme.typography.titleSmall, color = if (unread) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                            Text(a.getString("body") ?: "", style = MaterialTheme.typography.bodySmall)
                            a.millis("createdAt")?.let { Text(fmt(it), style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                }
            }
        }
    }
}

// ---------------- Privacy / account ----------------
@Composable
fun PrivacyScreen(modifier: Modifier) {
    Column(modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.privacy_title), style = MaterialTheme.typography.titleLarge)
        Text(stringResource(R.string.privacy_body))
        Text(FirebaseAuth.getInstance().currentUser?.email ?: "", style = MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick = { FirebaseAuth.getInstance().signOut() }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sign_out)) }
    }
}
