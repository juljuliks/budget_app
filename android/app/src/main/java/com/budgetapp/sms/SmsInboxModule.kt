package com.budgetapp.sms

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * JS side: the bank's SMS already in the phone's inbox (Импорт SMS в Настройках), oldest first. Only senders
 * SmsReceiver accepts: personal SMS never leave the inbox.
 */
class SmsInboxModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "SmsInbox"

    @ReactMethod
    fun readBankSms(sinceMs: Double, promise: Promise) {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("NO_PERMISSION", "READ_SMS not granted")
            return
        }
        try {
            val out = Arguments.createArray()
            ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE, Telephony.Sms.DATE_SENT),
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(sinceMs.toLong().toString()),
                "${Telephony.Sms.DATE} ASC"
            )?.use { c ->
                val iAddress = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val iBody = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val iDate = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
                val iSent = c.getColumnIndexOrThrow(Telephony.Sms.DATE_SENT)
                while (c.moveToNext()) {
                    val sender = c.getString(iAddress) ?: continue
                    if (!SmsReceiver.isBankSender(sender)) continue
                    out.pushMap(Arguments.createMap().apply {
                        putString("sender", sender)
                        putString("body", c.getString(iBody) ?: "")
                        putDouble("date", c.getLong(iDate).toDouble())
                        // the service centre time: what SmsReceiver passes for a live SMS (same dedup hash)
                        putDouble("dateSent", c.getLong(iSent).toDouble())
                    })
                }
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("READ_FAILED", e)
        }
    }
}

class SmsInboxPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(SmsInboxModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
