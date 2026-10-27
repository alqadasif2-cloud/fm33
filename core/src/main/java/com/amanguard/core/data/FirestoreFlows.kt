package com.amanguard.core.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

fun DocumentReference.flow(): Flow<DocumentSnapshot> = callbackFlow {
    val reg = addSnapshotListener { s, e -> if (e != null) close(e) else if (s != null) trySend(s) }
    awaitClose { reg.remove() }
}

fun Query.flow(): Flow<QuerySnapshot> = callbackFlow {
    val reg = addSnapshotListener { s, e -> if (e != null) close(e) else if (s != null) trySend(s) }
    awaitClose { reg.remove() }
}

/** value=null while loading; error != null on failure. */
data class Live<T>(val value: T? = null, val error: Throwable? = null)

@Composable
fun <T> Flow<T>.collectLive(key: Any?): State<Live<T>> = produceState(Live(), key) {
    try { collect { value = Live(it) } } catch (t: Throwable) { value = Live(null, t) }
}
