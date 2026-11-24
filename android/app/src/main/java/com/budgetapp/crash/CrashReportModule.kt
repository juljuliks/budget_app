package com.budgetapp.crash

import android.content.Context
import com.budgetapp.BuildConfig
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.firebase.FirebaseApp
import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * Crash reports (Firebase Crashlytics): the native crashes by itself; JS ones through this module — a fatal error of
 * the global handler and every console.error (src/native/crashReport.ts) as non-fatal, the message and the stack only
 * (no amounts, merchants or SMS: JS sends the logged text and Error's message, not the objects). Only a release build
 * ("1.0.N") with Firebase reports; "1.0-dev" and a build without google-services.json — nothing.
 */
class CrashReportModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "CrashReport"

    /** a JS error: `fatal` — the app's global handler (it is about to crash), else console.error */
    @ReactMethod
    fun recordError(message: String, stack: String, fatal: Boolean) {
        val crashlytics = crashlytics() ?: return
        crashlytics.setCustomKey("js_fatal", fatal)
        crashlytics.recordException(JsError(message, stack))
    }

    companion object {
        private fun crashlytics(): FirebaseCrashlytics? = try {
            FirebaseCrashlytics.getInstance()
        } catch (e: Exception) {
            null
        }

        /** On the app's start: collection on for a release build with Firebase only. */
        fun setUp(ctx: Context) {
            if (FirebaseApp.getApps(ctx).isEmpty()) return
            val release = Regex("^\\d+(\\.\\d+)*$").matches(BuildConfig.VERSION_NAME)
            crashlytics()?.setCrashlyticsCollectionEnabled(release && !BuildConfig.DEBUG)
        }
    }
}

/** A JS error as Crashlytics shows it: its message for the title, the JS stack as the frames. */
class JsError(message: String, jsStack: String) : Exception(message) {
    init {
        stackTrace = jsStack.lines().map { it.trim() }.filter { it.isNotEmpty() }.take(40).map { line ->
            // "fn@index.android.bundle:1:2345" / "at fn (file:1:2)": the function and where, as a frame
            val fn = line.substringBefore('@').removePrefix("at ").substringBefore(" (").ifEmpty { "<anonymous>" }
            val at = line.substringAfter('@', line.substringAfter("(", "").removeSuffix(")"))
            StackTraceElement("JS", fn, at.substringBefore(':').ifEmpty { "bundle" }, at.split(':').getOrNull(1)?.toIntOrNull() ?: 0)
        }.toTypedArray()
    }
}

class CrashReportPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(CrashReportModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
