package com.amanguard.core.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.amanguard.core.R
import com.amanguard.core.model.PermId
import com.amanguard.core.model.PermInfo
import com.amanguard.core.model.PermState
import com.amanguard.core.permissions.PermissionStatusRepository
import java.text.DateFormat
import java.util.Date

private fun Context.findActivity(): Activity? {
    var c = this
    while (c is ContextWrapper) { if (c is Activity) return c; c = c.baseContext }
    return null
}

@Composable
fun stateLabel(s: PermState) = stringResource(when (s) {
    PermState.GRANTED -> R.string.state_granted
    PermState.DENIED -> R.string.state_denied
    PermState.NOT_REQUESTED -> R.string.state_not_requested
    PermState.NEEDS_MANUAL -> R.string.state_needs_manual
    PermState.PARTIAL -> R.string.state_partial
    PermState.UNAVAILABLE -> R.string.state_unavailable
    PermState.REVOKED -> R.string.state_revoked
    PermState.NEEDS_REAUTH -> R.string.state_needs_reauth
})

fun stateColor(s: PermState): Color = when (s) {
    PermState.GRANTED -> StatusGreen
    PermState.PARTIAL, PermState.NEEDS_MANUAL, PermState.NOT_REQUESTED, PermState.NEEDS_REAUTH -> StatusAmber
    PermState.UNAVAILABLE -> StatusGrey
    else -> StatusRed
}

@Composable
fun StatusChip(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
        Text(text, color = color, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

/** Re-checks every time the app returns to the foreground (e.g. from Android Settings). */
@Composable
fun RecheckOnResume(repo: PermissionStatusRepository) {
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val o = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) repo.refresh() }
        owner.lifecycle.addObserver(o)
        onDispose { owner.lifecycle.removeObserver(o) }
    }
}

/** Returns a function that requests/fixes one permission using the right Android path. */
@Composable
fun rememberPermissionActions(repo: PermissionStatusRepository): (PermId) -> Unit {
    val ctx = LocalContext.current
    var pending by remember { mutableStateOf<PermId?>(null) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        pending?.let { repo.manager.markRequested(it) }
        repo.refresh()
    }
    return remember(repo) {
        { requested: PermId ->
            val m = repo.manager
            // Background location can only be requested after precise location is granted.
            val id = if (requested == PermId.LOCATION_BACKGROUND && m.check(PermId.LOCATION_FINE) != PermState.GRANTED) PermId.LOCATION_FINE else requested
            val rt = m.runtimePermissions(id)
            if (rt.isNotEmpty() && !m.needsSettings(id)) {
                val act = ctx.findActivity()
                val permanentlyDenied = m.check(id) == PermState.DENIED && act != null &&
                    rt.none { ActivityCompat.shouldShowRequestPermissionRationale(act, it) }
                if (permanentlyDenied) ctx.startActivity(m.settingsIntent(id))
                else { pending = id; launcher.launch(rt) }
            } else {
                m.markRequested(id)
                ctx.startActivity(m.settingsIntent(id))
            }
        }
    }
}

@Composable
fun PermissionWizard(repo: PermissionStatusRepository, required: List<PermId>, onFinished: () -> Unit) {
    RecheckOnResume(repo)
    val act = rememberPermissionActions(repo)
    val infos by repo.state.collectAsStateWithLifecycle()
    var index by rememberSaveable { mutableIntStateOf(0) }
    val id = required[index]
    val info = infos.firstOrNull { it.id == id } ?: return
    val done = info.state == PermState.GRANTED
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(stringResource(R.string.wizard_title, index + 1, required.size), style = MaterialTheme.typography.labelLarge)
        LinearProgressIndicator(progress = { (index + 1f) / required.size }, modifier = Modifier.fillMaxWidth())
        Text(stringResource(id.title), style = MaterialTheme.typography.headlineSmall)
        StatusChip(stateLabel(info.state), stateColor(info.state))
        Text(stringResource(R.string.wizard_feature, stringResource(id.feature)), style = MaterialTheme.typography.titleSmall)
        Text(stringResource(id.reason), style = MaterialTheme.typography.bodyMedium)
        if (!done) Text(stringResource(R.string.wizard_skip_warning, stringResource(id.feature)), color = StatusAmber, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.weight(1f))
        if (!done) Button(onClick = { act(id) }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.action_enable)) }
        val last = index == required.lastIndex
        OutlinedButton(onClick = { if (last) onFinished() else index++ }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(if (done) R.string.action_next else R.string.action_skip))
        }
    }
}

@Composable
fun PermissionStatusScreen(repo: PermissionStatusRepository, modifier: Modifier = Modifier) {
    RecheckOnResume(repo)
    val act = rememberPermissionActions(repo)
    val infos by repo.state.collectAsStateWithLifecycle()
    LazyColumn(modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(stringResource(R.string.status_title), style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = { repo.refresh() }) { Text(stringResource(R.string.action_recheck)) }
            }
        }
        items(infos, key = { it.id.key }) { PermissionRow(it) { act(it.id) } }
    }
}

@Composable
fun PermissionRow(info: PermInfo, onFix: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(info.id.title), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                StatusChip(stateLabel(info.state), stateColor(info.state))
            }
            Text(stringResource(R.string.wizard_feature, stringResource(info.id.feature)), style = MaterialTheme.typography.bodySmall)
            Text(stringResource(info.id.reason), style = MaterialTheme.typography.bodySmall)
            val t = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(info.checkedAt))
            Text(stringResource(R.string.status_last_checked, t), style = MaterialTheme.typography.labelSmall)
            if (info.state != PermState.GRANTED && info.state != PermState.UNAVAILABLE)
                Button(onClick = onFix) { Text(stringResource(if (info.state == PermState.NOT_REQUESTED) R.string.action_enable else R.string.action_fix)) }
        }
    }
}
