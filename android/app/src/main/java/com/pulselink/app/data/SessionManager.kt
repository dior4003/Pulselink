package com.pulselink.app.data

import android.content.Context

class SessionManager(context: Context) {
    private val prefs = context.getSharedPreferences("pulselink_prefs", Context.MODE_PRIVATE)

    var token: String
        get() = prefs.getString("token", "") ?: ""
        set(value) = prefs.edit().putString("token", value).apply()

    var serverUrl: String
        get() = prefs.getString("server_url", "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var darkTheme: Boolean
        get() = prefs.getBoolean("dark_theme", true)
        set(value) = prefs.edit().putBoolean("dark_theme", value).apply()

    var devMode: Boolean
        get() = prefs.getBoolean("dev_mode", false)
        set(value) = prefs.edit().putBoolean("dev_mode", value).apply()

    fun clearAuth() {
        prefs.edit().remove("token").apply()
    }
}
