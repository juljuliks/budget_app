package com.budgetapp.lock

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager

/**
 * "Блокировка" for JS (src/native/appLock.ts): the PIN kept and checked here (LockStore), the system fingerprint / face
 * window (BiometricPrompt). Screenshots stay allowed.
 */
class AppLockModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "AppLock"

    /** Read once on start: the lock screen is shown before the first frame, without waiting for a promise. */
    override fun getConstants(): Map<String, Any> = mapOf("pin" to LockStore.hasPin(ctx), "biometric" to LockStore.biometric(ctx))

    @ReactMethod
    fun getState(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("pin", LockStore.hasPin(ctx))
            putInt("pinLength", LockStore.pinLength(ctx))
            putBoolean("biometric", LockStore.biometric(ctx))
            putBoolean("biometricAvailable", biometricAvailable())
            putInt("delayS", LockStore.delayS(ctx))
            putBoolean("hideNotifications", LockStore.hideNotifications(ctx))
            putInt("waitS", LockStore.waitS(ctx))
        })
    }

    @ReactMethod
    fun setPin(pin: String?, promise: Promise) {
        LockStore.setPin(ctx, pin)
        promise.resolve(true)
    }

    @ReactMethod
    fun checkPin(pin: String, promise: Promise) {
        val (ok, left, wait) = LockStore.check(ctx, pin)
        promise.resolve(Arguments.createMap().apply {
            putBoolean("ok", ok)
            putInt("left", left)
            putInt("waitS", wait)
        })
    }

    @ReactMethod
    fun setBiometric(on: Boolean, promise: Promise) { LockStore.setBiometric(ctx, on); promise.resolve(true) }

    @ReactMethod
    fun setDelay(seconds: Int, promise: Promise) { LockStore.setDelay(ctx, seconds); promise.resolve(true) }

    @ReactMethod
    fun setHideNotifications(on: Boolean, promise: Promise) { LockStore.setHideNotifications(ctx, on); promise.resolve(true) }

    /**
     * The system fingerprint / face window: "ok", "pin" (its "Ввести PIN-код" pressed), "cancel" (closed), "error"
     * (no sensor, nothing enrolled, too many tries — the PIN then).
     */
    @ReactMethod
    fun authenticate(title: String, subtitle: String, negative: String, promise: Promise) {
        val activity = currentActivity as? FragmentActivity ?: return promise.resolve("error")
        UiThreadUtil.runOnUiThread {
            val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    LockStore.resetFailures(ctx)
                    promise.resolve("ok")
                }

                override fun onAuthenticationError(code: Int, message: CharSequence) {
                    promise.resolve(when (code) {
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "pin"
                        BiometricPrompt.ERROR_USER_CANCELED, BiometricPrompt.ERROR_CANCELED -> "cancel"
                        else -> "error"
                    })
                }
                // a finger not recognised: the window says so and waits for another try
            })
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setNegativeButtonText(negative)
                .setAllowedAuthenticators(BIOMETRIC_WEAK)
                .build()
            try {
                prompt.authenticate(info)
            } catch (e: Exception) {
                promise.resolve("error")
            }
        }
    }

    private fun biometricAvailable() =
        BiometricManager.from(ctx).canAuthenticate(BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
}

class AppLockPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(AppLockModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
