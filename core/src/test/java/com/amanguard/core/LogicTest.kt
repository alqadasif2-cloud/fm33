package com.amanguard.core

import com.amanguard.core.model.Connection
import com.amanguard.core.model.Freshness
import com.amanguard.core.model.PermState
import com.amanguard.core.permissions.PermissionLogic
import org.junit.Assert.assertEquals
import org.junit.Test

class LogicTest {
    @Test fun grantedOnlyWhenReallyGranted() {
        assertEquals(PermState.GRANTED, PermissionLogic.resolve(true, false, false, false, false))
        assertEquals(PermState.NOT_REQUESTED, PermissionLogic.resolve(false, false, false, false, false))
        assertEquals(PermState.DENIED, PermissionLogic.resolve(false, false, true, false, false))
        assertEquals(PermState.NEEDS_MANUAL, PermissionLogic.resolve(false, false, true, false, true))
    }
    @Test fun revokedAfterGranted() = assertEquals(PermState.REVOKED, PermissionLogic.resolve(false, false, true, true, false))
    @Test fun partialLocation() = assertEquals(PermState.PARTIAL, PermissionLogic.resolve(false, true, true, false, false))
    @Test fun freshness() {
        val now = 10_000_000L
        assertEquals(Connection.UNKNOWN, Freshness.connection(null, now))
        assertEquals(Connection.ONLINE, Freshness.connection(now - 60_000, now))
        assertEquals(Connection.STALE, Freshness.connection(now - 30 * 60_000, now))
        assertEquals(Connection.OFFLINE, Freshness.connection(now - 90 * 60_000, now))
    }
}
