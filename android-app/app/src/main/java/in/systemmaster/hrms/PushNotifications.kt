package `in`.systemmaster.hrms

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Shared helpers for the "alerts" notification channel (tasks, leave, approvals). */
object PushNotifications {
    const val CHANNEL_ID = "alerts"
    const val EXTRA_LINK = "link"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = context.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Alerts & approvals", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New tasks, leave requests, approvals and reminders"
                enableVibration(true)
                setShowBadge(true)
            }
        )
    }

    fun enabled(context: Context): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL_ID)
            if (ch != null && ch.importance == NotificationManager.IMPORTANCE_NONE) return false
        }
        return true
    }

    /** Intent that opens the app on a given in-app path, e.g. "/tasks". */
    fun openIntent(context: Context, link: String?): Intent =
        Intent(context, MainActivity::class.java).apply {
            putExtra(EXTRA_LINK, link ?: "/dashboard")
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

    fun show(context: Context, id: String?, title: String, body: String, link: String?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) return

        createChannel(context)
        val key = id ?: System.currentTimeMillis().toString()
        val pending = PendingIntent.getActivity(
            context, key.hashCode(), openIntent(context, link),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(context, R.color.brand))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(context).notify(key.hashCode(), n)
    }
}
