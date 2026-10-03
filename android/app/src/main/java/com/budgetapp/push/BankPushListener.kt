package com.budgetapp.push

import android.app.Notification
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.budgetapp.sms.SmsHeadlessService
import com.facebook.react.HeadlessJsTaskService

/**
 * Reads push notifications of the bank app (enabled by the user in "Доступ к уведомлениям") and hands
 * their text to the same Headless JS task as SMS. Every other app's notifications are dropped right here:
 * nothing about them is stored or passed on.
 */
class BankPushListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val n = sbn ?: return
        if (!isBankApp(n.packageName)) return
        // group summaries repeat the last message
        if (n.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = n.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        val body = listOf(title, text).filter { it.isNotBlank() }.joinToString("\n")
        if (body.isBlank()) return

        val intent = Intent(this, SmsHeadlessService::class.java).apply {
            putExtra(SmsHeadlessService.EXTRA_SENDER, "push:${n.packageName}")
            putExtra(SmsHeadlessService.EXTRA_BODY, body)
            putExtra(SmsHeadlessService.EXTRA_TIMESTAMP, n.postTime)
            putExtra(SmsHeadlessService.EXTRA_SOURCE, "push")
        }
        try {
            startService(intent)
            HeadlessJsTaskService.acquireWakeLockNow(this)
        } catch (e: IllegalStateException) {
            Log.e(TAG, "Unable to start SmsHeadlessService for a push", e)
        }
    }

    companion object {
        private const val TAG = "BankPushListener"

        /** TBC apps ("ge.tbcbank...", "com.tbc..."); matched loosely until the exact package is confirmed. */
        fun isBankApp(pkg: String?): Boolean = pkg != null && pkg.lowercase().contains("tbc")
    }
}
