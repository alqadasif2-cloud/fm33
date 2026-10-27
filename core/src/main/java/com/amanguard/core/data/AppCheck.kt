package com.amanguard.core.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

object AppCheck {
    /** Call from Application.onCreate. Debug builds use the debug provider (register the token in Firebase console). */
    fun install(ctx: Context, debug: Boolean) {
        FirebaseApp.initializeApp(ctx)
        FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
            if (debug) DebugAppCheckProviderFactory.getInstance() else PlayIntegrityAppCheckProviderFactory.getInstance()
        )
    }
}
