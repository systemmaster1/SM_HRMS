package `in`.systemmaster.hrms

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.provider.Settings
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import org.json.JSONObject
import java.io.File

/**
 * JavaScript bridge exposed as window.SMHRMSNative.
 * Every method first checks [isTrustedPage]: the bridge only works while the
 * WebView shows our own web app (exact https host match), never another site.
 */
class NativeBridge(
    private val activity: Activity,
    private val isTrustedPage: () -> Boolean,
) {
    private fun trusted(): Boolean = try { isTrustedPage() } catch (_: Exception) { false }

    /** Only https Supabase endpoints are accepted for the native GPS uploader. */
    private fun safeConfig(configJson: String): JSONObject? {
        val json = JSONObject(configJson)
        val url = json.optString("supabaseUrl")
        return try {
            val u = android.net.Uri.parse(url)
            if (u.scheme.equals("https", true) && !u.host.isNullOrBlank()) json else null
        } catch (_: Exception) { null }
    }

    @JavascriptInterface
    fun startDutyTracking(configJson: String): String {
        if (!trusted()) return "error:untrusted_page"
        return try {
            val json = safeConfig(configJson) ?: return "error:invalid_config"
            NativePrefs.save(activity, json)
            val intent = Intent(activity, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_START
            }
            val fine = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (!fine && !coarse) {
                (activity as? MainActivity)?.requestLocationFromBridge()
                return "permission_required"
            }
            try {
                ContextCompat.startForegroundService(activity, intent)
                // Duty tracking also needs "Allow all the time" so it keeps
                // working with the screen off. Separate disclosure first.
                (activity as? MainActivity)?.requestBackgroundLocationFromBridge()
                "started"
            } catch (e: SecurityException) {
                NativePrefs.setError(activity, "Tracking start blocked by Android permission or app-state rules")
                "error:tracking_not_allowed"
            } catch (e: IllegalStateException) {
                NativePrefs.setError(activity, "Tracking start blocked while app is restricted")
                "error:app_state_restricted"
            }
        } catch (e: Throwable) {
            NativePrefs.setError(activity, "Tracking bridge could not start")
            "error:tracking_bridge"
        }
    }

    @JavascriptInterface
    fun updateTrackingConfig(configJson: String): String {
        if (!trusted()) return "error:untrusted_page"
        return try {
            val json = safeConfig(configJson) ?: return "error:invalid_config"
            NativePrefs.save(activity, json)
            "updated"
        } catch (e: Exception) { "error:config" }
    }

    @JavascriptInterface
    fun stopDutyTracking(): String {
        if (!trusted()) return "error:untrusted_page"
        val intent = Intent(activity, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP
        }
        activity.startService(intent)
        return "stopped"
    }

    /** Firebase token of this phone ("" until Firebase has issued one). */
    @JavascriptInterface
    fun getPushToken(): String = if (trusted()) NativePrefs.pushToken(activity) else ""

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
    fun getTrackingStatus(): String = if (!trusted()) "{}" else JSONObject().apply {
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
        if (!trusted()) return "error:untrusted_page"
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
            "error:save_failed"
        }
    }

    /**
     * Keeps the phone's status bar and navigation bar the same colour as the
     * app screen (white in light mode, dark slate in dark mode), so the app
     * looks native instead of showing a mismatched coloured strip.
     */
    @JavascriptInterface
    fun setSystemBarsTheme(mode: String) {
        val dark = mode == "dark"
        activity.runOnUiThread {
            val w = activity.window
            val color = if (dark) 0xFF0F172A.toInt() else 0xFFFFFFFF.toInt()
            w.statusBarColor = color
            w.navigationBarColor = color
            val c = WindowCompat.getInsetsController(w, w.decorView)
            c.isAppearanceLightStatusBars = !dark
            c.isAppearanceLightNavigationBars = !dark
        }
    }
}
