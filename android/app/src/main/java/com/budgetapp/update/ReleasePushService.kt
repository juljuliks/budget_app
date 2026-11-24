package com.budgetapp.update

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * A release's push (Firebase Cloud Messaging, topic [TOPIC]; .github/workflows/android-release.yml sends it once the
 * release is published, scripts/notify-release.mjs): a data message {version} — «Доступна версия 1.0.N» by
 * UpdateNotices' rules (every newer version, once). No server of our own, no token kept: the app only subscribes to the topic.
 */
class ReleasePushService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val version = message.data["version"] ?: return
        UpdateNotices.notifyAvailable(applicationContext, version)
    }

    // a topic needs no token on our side
    override fun onNewToken(token: String) {}

    companion object {
        const val TOPIC = "releases"

        /** Subscribed on start; a build without google-services.json (no Firebase) — nothing. */
        fun subscribe(ctx: Context) {
            try {
                if (FirebaseApp.getApps(ctx).isEmpty()) return
                FirebaseMessaging.getInstance().subscribeToTopic(TOPIC)
            } catch (e: Exception) {
                Log.w("AppUpdate", "release topic not subscribed", e)
            }
        }
    }
}
