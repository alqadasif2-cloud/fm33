package com.amanguard.core.model

/** Pure helper: never present cached data as live. */
object Freshness {
    const val ONLINE_WINDOW_MS = 20 * 60_000L   // heartbeat every 15 min
    const val OFFLINE_AFTER_MS = 45 * 60_000L

    fun connection(lastSeenMs: Long?, nowMs: Long): Connection = when {
        lastSeenMs == null -> Connection.UNKNOWN
        nowMs - lastSeenMs <= ONLINE_WINDOW_MS -> Connection.ONLINE
        nowMs - lastSeenMs <= OFFLINE_AFTER_MS -> Connection.STALE
        else -> Connection.OFFLINE
    }
}
