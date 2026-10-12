package com.budgetapp.lock

import android.content.Context
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * "Блокировка": the PIN (only its PBKDF2 hash with a salt), the fingerprint switch, how long the app may stay in the
 * background without asking, hiding the amounts in the notifications, failed attempts. Kept apart from the database:
 * a backup restored on another phone doesn't bring an old PIN.
 */
object LockStore {
    private const val PREFS = "app_lock"
    private const val ITERATIONS = 100_000
    const val ATTEMPTS = 5
    private const val BLOCK_MS = 30_000L
    /** "Всегда": the PIN on every coming back */
    const val DEFAULT_DELAY_S = 0

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun hasPin(ctx: Context) = prefs(ctx).contains("hash")
    fun pinLength(ctx: Context) = prefs(ctx).getInt("length", 0)
    fun biometric(ctx: Context) = prefs(ctx).getBoolean("biometric", false)
    fun delayS(ctx: Context) = prefs(ctx).getInt("delay", DEFAULT_DELAY_S)
    fun hideNotifications(ctx: Context) = prefs(ctx).getBoolean("hide_notifications", false)

    /** A new PIN (a new salt); null: the lock off — the PIN and every setting of it gone. */
    fun setPin(ctx: Context, pin: String?) {
        if (pin == null) {
            prefs(ctx).edit().clear().apply()
            return
        }
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        prefs(ctx).edit()
            .putString("salt", b64(salt))
            .putInt("iterations", ITERATIONS)
            .putString("hash", b64(hash(pin, salt, ITERATIONS)))
            .putInt("length", pin.length)
            .remove("failures").remove("blocked_until")
            .apply()
    }

    fun setBiometric(ctx: Context, on: Boolean) = prefs(ctx).edit().putBoolean("biometric", on).apply()
    fun setDelay(ctx: Context, seconds: Int) = prefs(ctx).edit().putInt("delay", seconds).apply()
    fun setHideNotifications(ctx: Context, on: Boolean) = prefs(ctx).edit().putBoolean("hide_notifications", on).apply()

    /** Seconds left to wait after too many wrong PINs (0: may try). */
    fun waitS(ctx: Context): Int {
        val left = prefs(ctx).getLong("blocked_until", 0) - System.currentTimeMillis()
        return if (left > 0) ((left + 999) / 1000).toInt() else 0
    }

    /**
     * Checks a PIN: ok, or the attempts left; after ATTEMPTS wrong ones in a row the next try waits 30 s (then
     * ATTEMPTS more). While waiting the PIN isn't checked.
     */
    fun check(ctx: Context, pin: String): Triple<Boolean, Int, Int> {
        val p = prefs(ctx)
        val wait = waitS(ctx)
        if (wait > 0) return Triple(false, 0, wait)
        val salt = unb64(p.getString("salt", null) ?: return Triple(false, 0, 0))
        val ok = MessageDigest.isEqual(hash(pin, salt, p.getInt("iterations", ITERATIONS)), unb64(p.getString("hash", "")!!))
        if (ok) {
            p.edit().remove("failures").remove("blocked_until").apply()
            return Triple(true, ATTEMPTS, 0)
        }
        val failures = p.getInt("failures", 0) + 1
        if (failures >= ATTEMPTS) {
            p.edit().putInt("failures", 0).putLong("blocked_until", System.currentTimeMillis() + BLOCK_MS).apply()
            return Triple(false, 0, waitS(ctx))
        }
        p.edit().putInt("failures", failures).apply()
        return Triple(false, ATTEMPTS - failures, 0)
    }

    /** A fingerprint let the user in: the wrong PINs before it are forgotten. */
    fun resetFailures(ctx: Context) = prefs(ctx).edit().remove("failures").remove("blocked_until").apply()

    private fun hash(pin: String, salt: ByteArray, iterations: Int): ByteArray =
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(PBEKeySpec(pin.toCharArray(), salt, iterations, 256)).encoded

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)
}
