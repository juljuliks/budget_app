package com.budgetapp.backup

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * The backups' password ("Пароль для копий"): a copy is encrypted with a key derived from it (PBKDF2-SHA256, AES-256-GCM),
 * so it opens on any phone with the password and nowhere without it. The derived key is kept on this phone wrapped by
 * an Android Keystore key, so the weekly automatic copy doesn't ask for the password. Kept apart from the database: a
 * restored copy doesn't change it.
 *
 * File: "BUDGETENC1" | iterations (int) | salt (16) | iv (12) | ciphertext with the GCM tag.
 */
object BackupCrypto {
    private val MAGIC = "BUDGETENC1".toByteArray(Charsets.US_ASCII)
    private const val ITERATIONS = 310_000
    private const val PREFS = "backup_password"
    private const val WRAP_ALIAS = "budget_backup_wrap"

    class WrongPassword : Exception("wrong password")

    fun hasPassword(ctx: Context) = prefs(ctx).contains("key")

    /** Sets the password (a new salt and key), or clears it (null). */
    fun setPassword(ctx: Context, password: String?) {
        if (password == null) {
            prefs(ctx).edit().clear().apply()
            return
        }
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val key = derive(password, salt, ITERATIONS)
        val wrap = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, wrappingKey()) }
        prefs(ctx).edit()
            .putString("salt", b64(salt))
            .putInt("iterations", ITERATIONS)
            .putString("iv", b64(wrap.iv))
            .putString("key", b64(wrap.doFinal(key.encoded)))
            .apply()
    }

    /** Is the file an encrypted copy (by its first bytes). */
    fun isEncrypted(file: File): Boolean {
        if (file.length() < MAGIC.size) return false
        val head = ByteArray(MAGIC.size)
        file.inputStream().use { it.read(head) }
        return head.contentEquals(MAGIC)
    }

    /** Encrypts `source` into `target` with the stored key (the password must be set). */
    fun encrypt(ctx: Context, source: File, target: File) {
        val p = prefs(ctx)
        val salt = unb64(p.getString("salt", null) ?: throw IllegalStateException("No backup password"))
        val iterations = p.getInt("iterations", ITERATIONS)
        val unwrap = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, wrappingKey(), GCMParameterSpec(128, unb64(p.getString("iv", null)!!)))
        }
        val key = SecretKeySpec(unwrap.doFinal(unb64(p.getString("key", null)!!)), "AES")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
        DataOutputStream(target.outputStream().buffered()).use { out ->
            out.write(MAGIC)
            out.writeInt(iterations)
            out.write(salt)
            out.write(cipher.iv)
            out.write(cipher.doFinal(source.readBytes()))
        }
    }

    /** Decrypts an encrypted copy into `target`; WrongPassword when the password doesn't open it. */
    fun decrypt(source: File, target: File, password: String) {
        DataInputStream(source.inputStream().buffered()).use { input ->
            val magic = ByteArray(MAGIC.size).also { input.readFully(it) }
            if (!magic.contentEquals(MAGIC)) throw IllegalArgumentException("Not an encrypted copy")
            val iterations = input.readInt()
            val salt = ByteArray(16).also { input.readFully(it) }
            val iv = ByteArray(12).also { input.readFully(it) }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.DECRYPT_MODE, derive(password, salt, iterations), GCMParameterSpec(128, iv))
            }
            val plain = try { cipher.doFinal(input.readBytes()) } catch (e: AEADBadTagException) { throw WrongPassword() }
            target.writeBytes(plain)
        }
    }

    private fun derive(password: String, salt: ByteArray, iterations: Int): SecretKey {
        val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
        val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        spec.clearPassword()
        return SecretKeySpec(bytes, "AES")
    }

    /** The Keystore key the derived key is kept under (never leaves the phone's secure hardware). */
    private fun wrappingKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(WRAP_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(WRAP_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build())
        }.generateKey()
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)
}
