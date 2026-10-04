package `in`.systemmaster.hrms

import android.content.Context
import org.json.JSONObject

object NativePrefs {
    private const val NAME = "sm_hrms_native"
    private fun p(c: Context) = c.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** Tracking configuration from the web app (and, when present, fresh session tokens). */
    fun save(c: Context, j: JSONObject) {
        val e = p(c).edit()
            .putString("supabaseUrl", j.optString("supabaseUrl"))
            .putString("anonKey", j.optString("anonKey"))
            .putString("userId", j.optString("userId"))
            .putString("employeeName", j.optString("employeeName", "Employee"))
            .putInt("intervalMinutes", j.optInt("intervalMinutes", 5).coerceIn(1, 60))
        val access = j.optString("accessToken")
        if (access.isNotBlank()) {
            e.putString("accessToken", access)
            val refresh = j.optString("refreshToken")
            if (refresh.isNotBlank()) e.putString("refreshToken", refresh)
            e.putLong("tokenUpdatedAt", System.currentTimeMillis())
        }
        e.apply()
    }
    fun str(c: Context, k: String) = p(c).getString(k, "") ?: ""
    fun interval(c: Context) = p(c).getInt("intervalMinutes", 5).coerceAtLeast(1)
    fun setRunning(c: Context, v: Boolean) = p(c).edit().putBoolean("running", v).apply()
    fun isRunning(c: Context) = p(c).getBoolean("running", false)
    fun setLastUpload(c: Context, v: String) = p(c).edit().putString("lastUploadAt", v).apply()
    fun lastUploadAt(c: Context) = str(c, "lastUploadAt")
    fun setError(c: Context, v: String) = p(c).edit().putString("lastError", v).apply()
    fun lastError(c: Context) = str(c, "lastError")
    fun setPushToken(c: Context, v: String) = p(c).edit().putString("pushToken", v).apply()
    fun pushToken(c: Context) = str(c, "pushToken")

    fun tokenUpdatedAt(c: Context) = p(c).getLong("tokenUpdatedAt", 0L)

    /**
     * New session tokens. Called by the web app on every Supabase token refresh
     * and by the native service when it had to refresh on its own (app closed).
     * Supabase refresh tokens rotate, so whoever refreshed last owns the valid
     * pair; the other side picks it up from here.
     */
    @Synchronized
    fun updateTokens(c: Context, access: String, refresh: String?) {
        if (access.isBlank()) return
        val e = p(c).edit().putString("accessToken", access)
        if (!refresh.isNullOrBlank()) e.putString("refreshToken", refresh)
        e.putLong("tokenUpdatedAt", System.currentTimeMillis())
        e.commit()
    }

    /** Sign-out: forget the session and everything tied to this user. */
    fun clearSession(c: Context) {
        p(c).edit()
            .remove("accessToken").remove("refreshToken").remove("tokenUpdatedAt")
            .remove("userId").remove("employeeName").putBoolean("running", false)
            .remove("lastUploadAt").remove("lastError").remove("nextFlushAt").remove("flushFailures")
            .commit()
    }

    fun nextFlushAt(c: Context) = p(c).getLong("nextFlushAt", 0L)
    fun flushFailures(c: Context) = p(c).getInt("flushFailures", 0)
    fun flushSucceeded(c: Context) = p(c).edit().putLong("nextFlushAt", 0L).putInt("flushFailures", 0).apply()
    fun flushFailed(c: Context) {
        val n = (flushFailures(c) + 1).coerceAtMost(10)
        // 30 s, 1, 2, 4, 8 … capped at 15 minutes.
        val delay = (30_000L shl (n - 1).coerceAtMost(5)).coerceAtMost(15 * 60_000L)
        p(c).edit().putInt("flushFailures", n).putLong("nextFlushAt", System.currentTimeMillis() + delay).apply()
    }
}
