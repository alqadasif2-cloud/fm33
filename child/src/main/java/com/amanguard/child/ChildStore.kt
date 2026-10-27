package com.amanguard.child

import android.content.Context

object ChildStore {
    private fun p(c: Context) = c.getSharedPreferences("child", Context.MODE_PRIVATE)
    fun familyId(c: Context) = p(c).getString("familyId", null)
    fun deviceId(c: Context) = p(c).getString("deviceId", null)
    fun familyName(c: Context) = p(c).getString("familyName", "") ?: ""
    fun isLinked(c: Context) = familyId(c) != null && deviceId(c) != null
    fun wizardDone(c: Context) = p(c).getBoolean("wizardDone", false)
    fun setWizardDone(c: Context) = p(c).edit().putBoolean("wizardDone", true).apply()
    fun lastSync(c: Context) = p(c).getLong("lastSync", 0L)
    fun setLastSync(c: Context, t: Long) = p(c).edit().putLong("lastSync", t).apply()
    fun link(c: Context, fid: String, did: String, name: String) =
        p(c).edit().putString("familyId", fid).putString("deviceId", did).putString("familyName", name).apply()
    fun clear(c: Context) = p(c).edit().clear().apply()
}
