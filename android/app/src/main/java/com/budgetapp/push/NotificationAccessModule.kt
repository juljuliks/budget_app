package com.budgetapp.push

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/** JS side: is "Доступ к уведомлениям" granted to this app, and open that settings screen. */
class NotificationAccessModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "NotificationAccess"

    @ReactMethod
    fun isEnabled(promise: Promise) {
        promise.resolve(NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName))
    }

    @ReactMethod
    fun openSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
    }
}

class NotificationAccessPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(NotificationAccessModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
