package com.amanguard.parent

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.amanguard.core.ui.AmanTheme
import com.amanguard.core.ui.StatusRed
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AmanTheme { Surface(Modifier.fillMaxSize()) { Root() } } }
    }
}

@Composable
private fun Root() {
    val auth = remember { FirebaseAuth.getInstance() }
    var user by remember { mutableStateOf(auth.currentUser) }
    DisposableEffect(Unit) {
        val l = FirebaseAuth.AuthStateListener { user = it.currentUser }
        auth.addAuthStateListener(l); onDispose { auth.removeAuthStateListener(l) }
    }
    if (user == null) AuthScreen() else Home()
}

@Composable
private fun AuthScreen() {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }; var pass by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf<String?>(null) }; var busy by remember { mutableStateOf(false) }
    val sent = stringResource(R.string.reset_sent)
    fun run(block: suspend () -> Unit) = scope.launch { busy = true; msg = null; try { block() } catch (e: Exception) { msg = e.message }; busy = false }
    Column(Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Spacer(Modifier.height(48.dp))
        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(email, { email = it.trim() }, label = { Text(stringResource(R.string.email)) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(pass, { pass = it }, label = { Text(stringResource(R.string.password)) }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        Button(onClick = { run { FirebaseAuth.getInstance().signInWithEmailAndPassword(email, pass).await() } }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sign_in)) }
        OutlinedButton(onClick = { run { FirebaseAuth.getInstance().createUserWithEmailAndPassword(email, pass).await() } }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sign_up)) }
        TextButton(onClick = { run { FirebaseAuth.getInstance().sendPasswordResetEmail(email).await(); msg = sent } }, enabled = email.isNotBlank() && !busy) { Text(stringResource(R.string.reset_password)) }
        msg?.let { Text(it, color = if (it == sent) MaterialTheme.colorScheme.primary else StatusRed) }
    }
}

@Composable
private fun Home() {
    val scope = rememberCoroutineScope()
    var familyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableIntStateOf(0) }
    var openDevice by remember { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf(false) }

    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        try {
            familyId = Backend.ensureFamily()
            FirebaseMessaging.getInstance().token.await().let { ParentMessagingService.register(it) }
        } catch (e: Exception) { error = e.message }
    }
    val fid = familyId
    if (fid == null) {
        Box(Modifier.fillMaxSize().padding(24.dp)) {
            if (error != null) Text(stringResource(R.string.err_generic, error!!), color = StatusRed) else CircularProgressIndicator()
        }; return
    }
    when {
        openDevice != null -> DeviceDetailScreen(fid, openDevice!!) { openDevice = null }
        adding -> AddChildScreen(fid) { adding = false }
        else -> Scaffold(
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(tab == 0, { tab = 0 }, { Icon(Icons.Default.People, null) }, label = { Text(stringResource(R.string.tab_children)) })
                    NavigationBarItem(tab == 1, { tab = 1 }, { Icon(Icons.Default.Notifications, null) }, label = { Text(stringResource(R.string.tab_alerts)) })
                    NavigationBarItem(tab == 2, { tab = 2 }, { Icon(Icons.Default.PrivacyTip, null) }, label = { Text(stringResource(R.string.tab_settings)) })
                }
            },
            floatingActionButton = { if (tab == 0) ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Default.Add, null) }, text = { Text(stringResource(R.string.add_child)) }) }
        ) { pad ->
            val m = Modifier.padding(pad)
            when (tab) {
                0 -> DashboardScreen(fid, m) { openDevice = it }
                1 -> AlertsScreen(fid, m)
                else -> PrivacyScreen(m)
            }
        }
    }
}
