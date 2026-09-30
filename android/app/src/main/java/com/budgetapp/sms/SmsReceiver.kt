package com.budgetapp.sms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "RECEIVE_SMS not granted, ignoring broadcast")
            return
        }

        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (parts.isEmpty()) return

        // A long SMS arrives as several PDUs; join them per sender into one message.
        parts.groupBy { it.originatingAddress ?: "" }.forEach { (sender, messages) ->
            if (!isBankSender(sender)) return@forEach

            val body = messages.joinToString("") { it.messageBody ?: "" }
            val timestamp = messages.first().timestampMillis

            val serviceIntent = Intent(context, SmsHeadlessService::class.java).apply {
                putExtra(SmsHeadlessService.EXTRA_SENDER, sender)
                putExtra(SmsHeadlessService.EXTRA_BODY, body)
                putExtra(SmsHeadlessService.EXTRA_TIMESTAMP, timestamp)
            }
            try {
                // SMS_RECEIVED temporarily allowlists the app, so startService is permitted
                // from the background on Android 8+.
                context.startService(serviceIntent)
                HeadlessJsTaskService.acquireWakeLockNow(context)
            } catch (e: IllegalStateException) {
                Log.e(TAG, "Unable to start SmsHeadlessService", e)
            }
        }
    }

    companion object {
        private const val TAG = "SmsReceiver"

        private val BANK_SENDER_PATTERNS = listOf(
            Regex("TBC", RegexOption.IGNORE_CASE),
            Regex("""^\+?995\d+$"""),
        )

        fun isBankSender(sender: String): Boolean =
            BANK_SENDER_PATTERNS.any { it.containsMatchIn(sender) }
    }
}
