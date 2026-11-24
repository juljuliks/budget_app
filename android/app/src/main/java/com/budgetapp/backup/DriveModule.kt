package com.budgetapp.backup

import android.app.Activity
import android.content.Intent
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.UserRecoverableAuthException
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The automatic copy on Google Drive (src/features/backup/cloud.ts): signed in with a Google account, the copies kept
 * in the app's hidden folder of that Drive (appDataFolder: only this app sees them, the user's own storage). Always
 * encrypted with the copies' password before they get here (the JS side refuses otherwise). Drive's REST API with the
 * account's token; no Firebase.
 */
class DriveModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx), ActivityEventListener {
    override fun getName() = "Drive"

    private var signingIn: Promise? = null

    init {
        ctx.addActivityEventListener(this)
    }

    private val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestScopes(Scope(SCOPE))
        .build()

    /** The account signed in with Drive's permission granted; null — none. */
    private fun account(): GoogleSignInAccount? =
        GoogleSignIn.getLastSignedInAccount(ctx)?.takeIf { GoogleSignIn.hasPermissions(it, Scope(SCOPE)) }

    /** The email signed in, or null. */
    @ReactMethod
    fun signedIn(promise: Promise) {
        promise.resolve(account()?.email)
    }

    /** The system's account picker and the permission to the app's folder on Drive: the email, or null if cancelled. */
    @ReactMethod
    fun signIn(promise: Promise) {
        val activity = currentActivity ?: return promise.reject("NO_ACTIVITY", "no activity")
        signingIn?.resolve(null)
        signingIn = promise
        // the account picked anew each time ("Сменить аккаунт" too)
        val client = GoogleSignIn.getClient(activity, options)
        client.signOut().addOnCompleteListener { activity.startActivityForResult(client.signInIntent, REQUEST) }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST) return
        val promise = signingIn ?: return
        signingIn = null
        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException::class.java)
            promise.resolve(if (GoogleSignIn.hasPermissions(account, Scope(SCOPE))) account.email else null)
        } catch (e: ApiException) {
            // 12501: cancelled by the user
            if (e.statusCode == 12501) promise.resolve(null) else promise.reject("SIGN_IN", "Google sign-in failed: ${e.statusCode}", e)
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    @ReactMethod
    fun signOut(promise: Promise) {
        GoogleSignIn.getClient(ctx, options).signOut().addOnCompleteListener { promise.resolve(true) }
    }

    /** Drive's token for the account (on a worker thread); a permission taken back — the system's question shown. */
    private fun token(): String {
        val account = account()?.account ?: throw IllegalStateException("NOT_SIGNED_IN")
        return try {
            GoogleAuthUtil.getToken(ctx, account, "oauth2:$SCOPE")
        } catch (e: UserRecoverableAuthException) {
            e.intent?.let { currentActivity?.startActivity(it) }
            throw IllegalStateException("NEED_PERMISSION")
        }
    }

    private fun call(method: String, url: String, body: ((HttpURLConnection) -> Unit)? = null): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 20_000
        conn.readTimeout = 60_000
        conn.setRequestProperty("Authorization", "Bearer ${token()}")
        body?.let { conn.doOutput = true; it(conn) }
        if (conn.responseCode !in 200..299) {
            val err = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            throw IllegalStateException("Drive: HTTP ${conn.responseCode} $err")
        }
        return conn
    }

    private fun background(promise: Promise, work: () -> Any?) {
        Thread {
            try {
                promise.resolve(work())
            } catch (e: Exception) {
                promise.reject("DRIVE", e.message ?: "Drive failed", e)
            }
        }.start()
    }

    /** The file `name` of the app's files dir uploaded as `title` into the app's folder; then only the newest `keep` stay. */
    @ReactMethod
    fun upload(name: String, title: String, keep: Int, promise: Promise) = background(promise) {
        val file = File(ctx.filesDir, name)
        val boundary = "budget${System.nanoTime()}"
        val meta = JSONObject().put("name", title).put("parents", org.json.JSONArray().put("appDataFolder")).toString()
        call("POST", "$UPLOAD/files?uploadType=multipart&fields=id") { conn ->
            conn.setRequestProperty("Content-Type", "multipart/related; boundary=$boundary")
            conn.outputStream.use { out ->
                out.write("--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$boundary\r\nContent-Type: application/octet-stream\r\n\r\n".toByteArray())
                file.inputStream().use { it.copyTo(out) }
                out.write("\r\n--$boundary--\r\n".toByteArray())
            }
        }.disconnect()
        file.delete()
        // the older ones beyond `keep` go (the new one is in place first)
        list().drop(keep).forEach { call("DELETE", "$API/files/${it.getString("id")}").disconnect() }
        true
    }

    /** The copies in the app's folder, newest first. */
    private fun list(): List<JSONObject> {
        val conn = call("GET", "$API/files?spaces=appDataFolder&orderBy=createdTime%20desc&pageSize=100&fields=files(id,name,createdTime,size)")
        val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        conn.disconnect()
        val files = json.optJSONArray("files") ?: return emptyList()
        return (0 until files.length()).map { files.getJSONObject(it) }
    }

    /** [{ id, name, createdTime, size }], newest first. */
    @ReactMethod
    fun listCopies(promise: Promise) = background(promise) {
        Arguments.createArray().apply {
            list().forEach { f ->
                pushMap(Arguments.createMap().apply {
                    putString("id", f.getString("id"))
                    putString("name", f.optString("name"))
                    putString("createdTime", f.optString("createdTime"))
                    putDouble("size", f.optString("size", "0").toDoubleOrNull() ?: 0.0)
                })
            }
        }
    }

    /** The copy `id` downloaded into the app's files dir as `name`. */
    @ReactMethod
    fun download(id: String, name: String, promise: Promise) = background(promise) {
        val conn = call("GET", "$API/files/$id?alt=media")
        conn.inputStream.use { input -> File(ctx.filesDir, name).outputStream().use { input.copyTo(it) } }
        conn.disconnect()
        true
    }

    companion object {
        /** the app's own hidden folder on the user's Drive: nothing else of the Drive is seen */
        const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
        private const val API = "https://www.googleapis.com/drive/v3"
        private const val UPLOAD = "https://www.googleapis.com/upload/drive/v3"
        private const val REQUEST = 7301
    }
}

class DrivePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(DriveModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
