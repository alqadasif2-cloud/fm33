package com.amanguard.core.permissions

import com.amanguard.core.model.PermState

object PermissionLogic {
    /** Never reports GRANTED unless the real check passed. */
    fun resolve(granted: Boolean, partial: Boolean, requested: Boolean, everGranted: Boolean, manual: Boolean): PermState = when {
        granted -> PermState.GRANTED
        everGranted -> PermState.REVOKED
        partial -> PermState.PARTIAL
        !requested -> PermState.NOT_REQUESTED
        manual -> PermState.NEEDS_MANUAL
        else -> PermState.DENIED
    }
}
