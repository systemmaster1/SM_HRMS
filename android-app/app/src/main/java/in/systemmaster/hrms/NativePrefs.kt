package in.systemmaster.hrms

import android.content.Context
import org.json.JSONObject

object NativePrefs {
    private const val NAME = "sm_hrms_native"
    private fun p(c: Context) = c.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun save(c: Context, j: JSONObject) {
        p(c).edit()
            .putString("supabaseUrl", j.optString("supabaseUrl"))
            .putString("anonKey", j.optString("anonKey"))
            .putString("accessToken", j.optString("accessToken"))
            .putString("refreshToken", j.optString("refreshToken"))
            .putString("userId", j.optString("userId"))
            .putString("employeeName", j.optString("employeeName", "Employee"))
            .putInt("intervalMinutes", j.optInt("intervalMinutes", 5).coerceAtLeast(1))
            .apply()
    }
    fun str(c: Context, k: String) = p(c).getString(k, "") ?: ""
    fun interval(c: Context) = p(c).getInt("intervalMinutes", 5).coerceAtLeast(1)
    fun setRunning(c: Context, v: Boolean) = p(c).edit().putBoolean("running", v).apply()
    fun isRunning(c: Context) = p(c).getBoolean("running", false)
    fun setLastUpload(c: Context, v: String) = p(c).edit().putString("lastUploadAt", v).apply()
    fun lastUploadAt(c: Context) = str(c, "lastUploadAt")
    fun setError(c: Context, v: String) = p(c).edit().putString("lastError", v).apply()
    fun lastError(c: Context) = str(c, "lastError")
    fun updateTokens(c: Context, access: String, refresh: String?) {
        val e=p(c).edit().putString("accessToken", access)
        if (!refresh.isNullOrBlank()) e.putString("refreshToken", refresh)
        e.apply()
    }
}
