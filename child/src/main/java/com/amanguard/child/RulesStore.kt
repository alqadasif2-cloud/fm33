package com.amanguard.child

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

enum class BlockReason {
    RULE_BLOCKED,
    BEDTIME_ACTIVE,
    DAILY_LIMIT_EXCEEDED
}

object RulesStore {
    private const val PREF_NAME = "amanguard_rules"
    private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
    private const val KEY_BEDTIME_START = "bedtime_start" // e.g. "22:00"
    private const val KEY_BEDTIME_END = "bedtime_end"     // e.g. "06:00"
    private const val KEY_DAILY_LIMIT = "daily_limit"     // in minutes
    private const val KEY_APP_LIMITS = "app_limits"       // JSON { "com.example": 30 }
    private const val KEY_LAST_SYNC = "last_rules_sync"

    private fun prefs(context: Context) = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun saveRules(
        context: Context,
        blocked: Set<String>,
        bedtimeStart: String?,
        bedtimeEnd: String?,
        dailyLimitMin: Int,
        appLimits: Map<String, Int>
    ) {
        val jsonArray = JSONArray(blocked)
        val jsonLimits = JSONObject(appLimits)

        prefs(context).edit()
            .putString(KEY_BLOCKED_PACKAGES, jsonArray.toString())
            .putString(KEY_BEDTIME_START, bedtimeStart)
            .putString(KEY_BEDTIME_END, bedtimeEnd)
            .putInt(KEY_DAILY_LIMIT, dailyLimitMin)
            .putString(KEY_APP_LIMITS, jsonLimits.toString())
            .putLong(KEY_LAST_SYNC, System.currentTimeMillis())
            .apply()
    }

    fun getBlockedPackages(context: Context): Set<String> {
        val raw = prefs(context).getString(KEY_BLOCKED_PACKAGES, "[]") ?: "[]"
        val set = mutableSetOf<String>()
        return try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                set.add(arr.getString(i))
            }
            set
        } catch (e: Exception) {
            emptySet()
        }
    }

    fun checkPackage(context: Context, packageName: String): BlockReason? {
        // Never block AmanGuard itself or emergency dialers
        if (packageName == context.packageName || packageName.contains("dialer") || packageName.contains("telecom")) {
            return null
        }

        // 1. Check explicit block list
        val blocked = getBlockedPackages(context)
        if (blocked.contains(packageName)) {
            return BlockReason.RULE_BLOCKED
        }

        // 2. Check Bedtime Schedule
        val p = prefs(context)
        val bedtimeStart = p.getString(KEY_BEDTIME_START, null)
        val bedtimeEnd = p.getString(KEY_BEDTIME_END, null)
        if (!bedtimeStart.isNullOrBlank() && !bedtimeEnd.isNullOrBlank()) {
            if (isCurrentTimeInWindow(bedtimeStart, bedtimeEnd)) {
                return BlockReason.BEDTIME_ACTIVE
            }
        }

        return null
    }

    private fun isCurrentTimeInWindow(start: String, end: String): Boolean {
        return try {
            val cal = Calendar.getInstance()
            val nowMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

            val sParts = start.split(":")
            val startMin = sParts[0].toInt() * 60 + sParts[1].toInt()

            val eParts = end.split(":")
            val endMin = eParts[0].toInt() * 60 + eParts[1].toInt()

            if (startMin <= endMin) {
                // Same day window (e.g. 14:00 to 16:00)
                nowMin in startMin..endMin
            } else {
                // Overnight window (e.g. 22:00 to 06:00)
                nowMin >= startMin || nowMin <= endMin
            }
        } catch (e: Exception) {
            false
        }
    }
}
