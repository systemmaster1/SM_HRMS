package `in`.systemmaster.hrms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * After a phone restart, resumes duty tracking ONLY if it was running when the
 * phone switched off and the employee has granted "Allow all the time".
 * The service then asks the server whether the employee is still on duty
 * (Attendance IN without OUT) and stops itself immediately if not.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (!NativePrefs.isRunning(context)) return
        if (NativePrefs.str(context, "refreshToken").isBlank()) return
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        val background = Build.VERSION.SDK_INT < 29 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!fine || !background) return
        try {
            ContextCompat.startForegroundService(
                context,
                Intent(context, LocationTrackingService::class.java).apply {
                    this.action = LocationTrackingService.ACTION_START
                }
            )
        } catch (_: Exception) {
            NativePrefs.setError(context, "Android did not allow tracking to resume after restart. Open SM HRMS.")
        }
    }
}
