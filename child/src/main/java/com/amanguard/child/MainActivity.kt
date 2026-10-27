package com.amanguard.child

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.amanguard.core.ui.*
import com.google.android.gms.codescanner.GmsBarcodeScanning
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.DateFormat
import java.util.Date

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as ChildApp
        setContent { AmanTheme { Surface(Modifier.fillMaxSize()) { Root(app) } } }
    }
}

@Composable
private fun Root(app: ChildApp) {
    val ctx = LocalContext.current
    var linked by remember { mutableStateOf(ChildStore.isLinked(ctx)) }
    var wizard by remember { mutableStateOf(ChildStore.isLinked(ctx) && !ChildStore.wizardDone(ctx)) }
    when {
        !linked -> PairingScreen { linked = true; wizard = true }
        wizard -> PermissionWizard(app.permRepo, ChildApp.REQUIRED) { ChildStore.setWizardDone(ctx); wizard = false }
        else -> HomeShell(app) { linked = false }
    }
}

@Composable
private fun PairingScreen(onLinked: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<Pair<String, String>?>(null) } // family, child
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val fn = remember { FirebaseFunctions.getInstance() }

    suspend fun ensureAuth() { if (FirebaseAuth.getInstance().currentUser == null) FirebaseAuth.getInstance().signInAnonymously().await() }
    fun check() = scope.launch {
        busy = true; error = null
        try {
            ensureAuth()
            @Suppress("UNCHECKED_CAST")
            val r = fn.getHttpsCallable("previewPairingCode").call(mapOf("code" to code.trim())).await().data as Map<String, Any?>
            preview = (r["familyName"] as String) to (r["childName"] as String)
        } catch (e: Exception) { error = e.message }
        busy = false
    }
    fun confirm() = scope.launch {
        busy = true; error = null
        try {
            @Suppress("UNCHECKED_CAST")
            val r = fn.getHttpsCallable("redeemPairingCode").call(mapOf(
                "code" to code.trim(), "deviceName" to (Build.MODEL ?: "Android"), "manufacturer" to Build.MANUFACTURER,
                "model" to Build.MODEL, "sdk" to Build.VERSION.SDK_INT, "appVersion" to BuildConfig.VERSION_NAME,
            )).await().data as Map<String, Any?>
            ChildStore.link(ctx, r["familyId"] as String, r["deviceId"] as String, preview?.first ?: "")
            runCatching { FirebaseMessaging.getInstance().token.await().let { ChildMessagingService.saveToken(ctx, it) } }
            Scheduler.schedule(ctx)
            onLinked()
        } catch (e: Exception) { error = e.message }
        busy = false
    }

    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(stringResource(R.string.pair_title), style = MaterialTheme.typography.headlineMedium)
        val p = preview
        if (p == null) {
            Text(stringResource(R.string.pair_hint))
            OutlinedTextField(code, { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(8) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters))
            Button(onClick = { check() }, enabled = code.length == 8 && !busy, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.pair_check)) }
            OutlinedButton(onClick = {
                GmsBarcodeScanning.getClient(ctx).startScan()
                    .addOnSuccessListener { b -> b.rawValue?.let { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(8) } }
                    .addOnFailureListener { error = it.message }
            }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.pair_scan)) }
        } else {
            Text(stringResource(R.string.pair_found, p.first, p.second))
            Button(onClick = { confirm() }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.pair_confirm, p.first)) }
            TextButton(onClick = { preview = null }) { Text(stringResource(com.amanguard.core.R.string.action_recheck)) }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed) }
    }
}

@Composable
private fun HomeShell(app: ChildApp, onUnlinked: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    Scaffold(bottomBar = {
        NavigationBar {
            NavigationBarItem(tab == 0, { tab = 0 }, { Icon(Icons.Default.Home, null) }, label = { Text(stringResource(R.string.tab_home)) })
            NavigationBarItem(tab == 1, { tab = 1 }, { Icon(Icons.Default.Security, null) }, label = { Text(stringResource(R.string.tab_perms)) })
        }
    }) { pad ->
        if (tab == 0) Home(Modifier.padding(pad), onUnlinked) else PermissionStatusScreen(app.permRepo, Modifier.padding(pad))
    }
}

@Composable
private fun Home(modifier: Modifier, onUnlinked: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    val last = ChildStore.lastSync(ctx)
    Column(modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.home_linked, ChildStore.familyName(ctx)), style = MaterialTheme.typography.titleLarge)
        Text(if (last == 0L) stringResource(R.string.home_never)
             else stringResource(R.string.home_last_sync, DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(last))))
        Text(stringResource(R.string.home_active), style = MaterialTheme.typography.titleMedium)
        Text("• " + stringResource(R.string.home_feat_location)); Text("• " + stringResource(R.string.home_feat_usage))
        Text(stringResource(R.string.home_no_live), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.weight(1f))
        error?.let { Text(stringResource(R.string.err_generic, it), color = StatusRed) }
        OutlinedButton(onClick = {
            scope.launch {
                try {
                    FirebaseFunctions.getInstance().getHttpsCallable("unlinkDevice")
                        .call(mapOf("familyId" to ChildStore.familyId(ctx), "deviceId" to ChildStore.deviceId(ctx))).await()
                    Scheduler.cancel(ctx); ChildStore.clear(ctx); onUnlinked()
                } catch (e: Exception) { error = e.message }
            }
        }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.home_unlink)) }
    }
}
