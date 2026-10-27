package com.amanguard.child

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class AmanAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return

            // Don't intercept system launcher or self
            if (packageName == applicationContext.packageName) return

            val blockReason = RulesStore.checkPackage(applicationContext, packageName)
            if (blockReason != null) {
                Log.d("AmanAccessibility", "Blocking launch of $packageName due to $blockReason")
                
                // 1. Immediately drop to home screen to close the app
                performGlobalAction(GLOBAL_ACTION_HOME)

                // 2. Open the gentle BlockedAppActivity overlay
                val intent = Intent(applicationContext, BlockedAppActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra(BlockedAppActivity.EXTRA_PACKAGE, packageName)
                    putExtra(BlockedAppActivity.EXTRA_REASON, blockReason.name)
                }
                startActivity(intent)
            }
        }
    }

    override fun onInterrupt() {
        Log.w("AmanAccessibility", "AmanGuard Accessibility Service interrupted")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i("AmanAccessibility", "AmanGuard Accessibility Service connected and active")
    }
}
