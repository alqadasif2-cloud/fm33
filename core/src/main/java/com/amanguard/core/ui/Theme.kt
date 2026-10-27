package com.amanguard.core.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Teal = Color(0xFF0F766E)
private val Light = lightColorScheme(primary = Teal, secondary = Color(0xFF2563EB), tertiary = Color(0xFFB45309))
private val Dark = darkColorScheme(primary = Color(0xFF5EEAD4), secondary = Color(0xFF93C5FD), tertiary = Color(0xFFFCD34D))

val StatusGreen = Color(0xFF16A34A)
val StatusAmber = Color(0xFFD97706)
val StatusRed = Color(0xFFDC2626)
val StatusGrey = Color(0xFF6B7280)

/** Light/dark follows the system; RTL/LTR follows the app locale (values-ar / values). Font scale follows system. */
@Composable
fun AmanTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
