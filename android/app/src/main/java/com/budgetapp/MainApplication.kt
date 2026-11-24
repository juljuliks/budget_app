package com.budgetapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.budgetapp.backup.BackupPackage
import com.budgetapp.lock.AppLockPackage
import com.budgetapp.push.NotificationAccessPackage
import com.budgetapp.sms.BankSourcesPackage
import com.budgetapp.sms.SmsInboxPackage
import com.budgetapp.update.AppUpdatePackage
import com.budgetapp.update.ReleasePushService
import com.budgetapp.update.UpdateCheckWorker
import com.budgetapp.update.UpdateNotices

class MainApplication : Application(), ReactApplication {

    private val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        // Autolinked packages (Notifee, Picker, ...)
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages + NotificationAccessPackage() + SmsInboxPackage() + AppInfoPackage() + BackupPackage() + AppLockPackage() + BankSourcesPackage() + AppUpdatePackage()

        override fun getJSMainModuleName(): String = "index"

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }

    override fun getReactNativeHost(): ReactNativeHost = reactNativeHost

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            DefaultNewArchitectureEntryPoint.load()
        }
        // a newer release with the app closed too: its push (Firebase), and a check once a day if that one is lost
        ReleasePushService.subscribe(this)
        // «Доступна версия» of the version that is installed now: gone
        UpdateNotices.clearStale(this, opened = false)
        UpdateCheckWorker.schedule(this)
    }
}
