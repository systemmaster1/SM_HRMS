package `in`.systemmaster.hrms

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives Firebase pushes.
 * - App in background/closed: Android itself shows the notification
 *   (channel "alerts"); tapping it opens MainActivity with the "link" extra.
 * - App open: this method is called and we show the notification ourselves.
 */
class SmPushService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // The web app picks this up on its next load and registers it.
        NativePrefs.setPushToken(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = message.notification?.title ?: data["title"] ?: "SM HRMS"
        val body = message.notification?.body ?: data["body"] ?: ""
        PushNotifications.show(this, data["notification_id"], title, body, data["link"])
    }
}
