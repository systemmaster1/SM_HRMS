package `in`.systemmaster.hrms

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

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

    /**
     * Saves a file created by the web app (PDF report, CSV export) and opens
     * the Android share sheet, so the user can open it, save it to Files /
     * Drive, or send it on WhatsApp or email. WebView cannot download
     * browser-generated files on its own.
     */
    @JavascriptInterface
    fun saveFile(fileName: String, mimeType: String, base64: String): String {
        return try {
            val safe = fileName.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(120).ifBlank { "export" }
            val dir = File(activity.cacheDir, "exports").apply { mkdirs() }
            // Keep the folder small: remove exports older than a day.
            dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 86_400_000L) it.delete() }
            val file = File(dir, safe)
            file.writeBytes(Base64.decode(base64, Base64.DEFAULT))

            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = mimeType.ifBlank { "application/octet-stream" }
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TITLE, safe)
                clipData = ClipData.newRawUri(safe, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.runOnUiThread {
                try {
                    activity.startActivity(Intent.createChooser(send, "Open or save $safe"))
                } catch (_: Exception) { }
            }
            "saved"
        } catch (e: Exception) {
            "error:${e.message}"
        }
    }
}
