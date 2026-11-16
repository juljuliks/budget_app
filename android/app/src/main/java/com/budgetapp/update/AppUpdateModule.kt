package com.budgetapp.update

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * «Обновить» (Настройки, the toast on start): the newer release's APK downloaded into the cache (progress as
 * "AppUpdateProgress" events, 0..100) and handed to the system installer — it asks "Обновить?", the data stays.
 * Installing needs "install unknown apps" for this app: canInstall / openInstallSettings.
 */
class AppUpdateModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "AppUpdate"

    private fun apkFile() = File(File(ctx.cacheDir, "updates").apply { mkdirs() }, "update.apk")

    @ReactMethod
    fun download(url: String, promise: Promise) {
        Thread {
            val file = apkFile()
            try {
                var conn = URL(url).openConnection() as HttpURLConnection
                // GitHub sends the asset from another host: follow the redirects by hand (up to a few)
                var hops = 0
                while (conn.responseCode in 300..399 && hops++ < 5) {
                    val next = conn.getHeaderField("Location")
                    conn.disconnect()
                    conn = URL(URL(url), next).openConnection() as HttpURLConnection
                }
                if (conn.responseCode != 200) throw IllegalStateException("HTTP ${conn.responseCode}")
                val total = conn.contentLengthLong
                var done = 0L
                var lastPercent = -1
                conn.inputStream.use { input ->
                    file.outputStream().use { output ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            output.write(buf, 0, n)
                            done += n
                            val percent = if (total > 0) (done * 100 / total).toInt() else -1
                            if (percent != lastPercent) {
                                lastPercent = percent
                                emitProgress(percent)
                            }
                        }
                    }
                }
                conn.disconnect()
                promise.resolve(file.absolutePath)
            } catch (e: Exception) {
                file.delete()
                promise.reject("DOWNLOAD_FAILED", e.message ?: "download failed", e)
            }
        }.start()
    }

    private fun emitProgress(percent: Int) {
        val map = Arguments.createMap().apply { putInt("percent", percent) }
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("AppUpdateProgress", map)
    }

    @ReactMethod
    fun canInstall(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.packageManager.canRequestPackageInstalls())
    }

    /** The system's "install unknown apps" switch for this app. */
    @ReactMethod
    fun openInstallSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
        } else {
            Intent(Settings.ACTION_SECURITY_SETTINGS)
        }
        ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @ReactMethod
    fun install(path: String, promise: Promise) {
        try {
            val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.updates", File(path))
            val intent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message ?: "install failed", e)
        }
    }

    // NativeEventEmitter's bookkeeping
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}

class AppUpdatePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(AppUpdateModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
