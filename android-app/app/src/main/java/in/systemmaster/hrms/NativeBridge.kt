package in.systemmaster.hrms

import android.app.Activity
import android.content.Intent
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

    @JavascriptInterface
    fun getTrackingStatus(): String = JSONObject().apply {
        put("native", true)
        put("running", NativePrefs.isRunning(activity))
        put("lastUploadAt", NativePrefs.lastUploadAt(activity))
        put("lastError", NativePrefs.lastError(activity))
    }.toString()
}
