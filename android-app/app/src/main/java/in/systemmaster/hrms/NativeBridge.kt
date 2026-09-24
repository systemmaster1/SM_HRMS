package `in`.systemmaster.hrms

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.webkit.JavascriptInterface
import org.json.JSONObject

class NativeBridge(private val activity: Activity) {
    @JavascriptInterface
    fun startDutyTracking(configJson: String): String {
        return try {
            val json = JSONObject(configJson)
            NativePrefs.save(activity, json)
            val intent = Intent(activity, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_START
            }
            androidx.core.content.ContextCompat.startForegroundService(activity, intent)
            "started"
        } catch (e: Exception) {
            "error:${e.message}"
        }
    }

    @JavascriptInterface
    fun updateTrackingConfig(configJson: String): String {
        return try {
            NativePrefs.save(activity, JSONObject(configJson))
            "updated"
        } catch (e: Exception) { "error:${e.message}" }
    }

    @JavascriptInterface
    fun stopDutyTracking(): String {
        val intent = Intent(activity, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP
        }
        activity.startService(intent)
        return "stopped"
    }

    /** Firebase token of this phone ("" until Firebase has issued one). */
    @JavascriptInterface
    fun getPushToken(): String = NativePrefs.pushToken(activity)

    /** False if the user switched off notifications for SM HRMS. */
    @JavascriptInterface
    fun notificationsEnabled(): Boolean = PushNotifications.enabled(activity)

    @JavascriptInterface
    fun openNotificationSettings() {
        activity.runOnUiThread {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
            try { activity.startActivity(intent) } catch (_: Exception) { }
        }
    }

    @JavascriptInterface
    fun getTrackingStatus(): String = JSONObject().apply {
        put("native", true)
        put("running", NativePrefs.isRunning(activity))
        put("lastUploadAt", NativePrefs.lastUploadAt(activity))
        put("lastError", NativePrefs.lastError(activity))
    }.toString()
}
