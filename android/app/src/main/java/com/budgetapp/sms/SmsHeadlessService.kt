package com.budgetapp.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Hands a received SMS over to the `SmsBackgroundTask` Headless JS task.
 * Registered in JS via AppRegistry.registerHeadlessTask (see index.js).
 */
class SmsHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        val body = extras.getString(EXTRA_BODY) ?: return null

        val data = Arguments.createMap().apply {
            putString("sender", extras.getString(EXTRA_SENDER) ?: "")
            putString("body", body)
            putDouble("timestamp", extras.getLong(EXTRA_TIMESTAMP).toDouble())
            putString("source", extras.getString(EXTRA_SOURCE) ?: "sms")
        }

        return HeadlessJsTaskConfig(
            TASK_KEY,
            data,
            TASK_TIMEOUT_MS,
            // SMS can arrive while the app is open; process it the same way
            true
        )
    }

    companion object {
        const val TASK_KEY = "SmsBackgroundTask"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_BODY = "body"
        const val EXTRA_TIMESTAMP = "timestamp"
        /** "sms" or "push" (BankPushListener) */
        const val EXTRA_SOURCE = "source"
        private const val TASK_TIMEOUT_MS = 15_000L
    }
}
