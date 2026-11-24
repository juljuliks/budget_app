package com.budgetapp.config

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.firebase.FirebaseApp
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings

/**
 * Firebase Remote Config's parameters for JS (src/native/remoteConfig.ts): the bank's message templates
 * ("message_templates"). Fetched at most once an hour; offline — the last value fetched. A build without
 * google-services.json — null.
 */
class RemoteConfigModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RemoteConfig"

    @ReactMethod
    fun fetchString(key: String, promise: Promise) {
        if (FirebaseApp.getApps(ctx).isEmpty()) {
            promise.resolve(null)
            return
        }
        try {
            val rc = FirebaseRemoteConfig.getInstance()
            rc.setConfigSettingsAsync(FirebaseRemoteConfigSettings.Builder().setMinimumFetchIntervalInSeconds(3600).build())
            // fetched or not (offline, too soon): the value activated last
            rc.fetchAndActivate().addOnCompleteListener { promise.resolve(rc.getString(key)) }
        } catch (e: Exception) {
            promise.reject("REMOTE_CONFIG", e.message ?: "remote config failed", e)
        }
    }
}

class RemoteConfigPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(RemoteConfigModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
