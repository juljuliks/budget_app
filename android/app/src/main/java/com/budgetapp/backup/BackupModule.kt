package com.budgetapp.backup

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract
import com.facebook.react.ReactApplication
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File

/**
 * Files in and out of the app for "Резервная копия" (src/features/backup): the system "save as" and "open" dialogs
 * (the user picks the place: Downloads, Google Drive, …; no storage permission needed), and putting a checked copy
 * in place of the database. The database is quick-sqlite's: `app.db` in the app's files dir.
 */
class BackupModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx), ActivityEventListener {

    /** The dialog open now: its promise, what to do with the file the user picked, and on cancel. */
    private class Pending(val promise: Promise, val onPicked: (Uri) -> Any, val onCancel: () -> Unit)
    private var pending: Pending? = null

    init {
        ctx.addActivityEventListener(this)
    }

    override fun getName() = "Backup"

    /** Where quick-sqlite keeps its databases: a copy is written here first, a picked file is copied here. */
    override fun getConstants(): Map<String, Any> = mapOf("filesDir" to ctx.filesDir.absolutePath)

    /** "Save as" for the file `name` of the files dir, offered as `title`; true once written, false if cancelled. Deletes the file. */
    @ReactMethod
    fun saveFile(name: String, title: String, mime: String, promise: Promise) {
        val source = File(ctx.filesDir, name)
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
            .putExtra(Intent.EXTRA_TITLE, title)
        ask(intent, promise, { source.delete() }) { uri ->
            ctx.contentResolver.openOutputStream(uri, "w")!!.use { out -> source.inputStream().use { it.copyTo(out) } }
            source.delete()
            true
        }
    }

    /** "Save as" for a text (the operations as CSV), in UTF-8; true once written, false if cancelled. */
    @ReactMethod
    fun saveText(text: String, title: String, mime: String, promise: Promise) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
            .putExtra(Intent.EXTRA_TITLE, title)
        ask(intent, promise, {}) { uri ->
            ctx.contentResolver.openOutputStream(uri, "w")!!.use { it.write(text.toByteArray(Charsets.UTF_8)) }
            true
        }
    }

    /** "Open" a file; it is copied to `name` in the files dir. true once copied, false if cancelled. */
    @ReactMethod
    fun pickFile(name: String, promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
        ask(intent, promise, {}) { uri ->
            ctx.contentResolver.openInputStream(uri)!!.use { input -> File(ctx.filesDir, name).outputStream().use { input.copyTo(it) } }
            true
        }
    }

    /**
     * Picks a folder for the automatic copies; the permission to write there is kept across restarts. Its URI, or null
     * if cancelled.
     */
    @ReactMethod
    fun pickFolder(promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        ask(intent, promise, {}) { uri ->
            ctx.contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            uri.toString()
        }
    }

    /** The folder's name as the system shows it ("Download"); null when it is gone or no longer allowed. */
    @ReactMethod
    fun folderName(folder: String, promise: Promise) {
        try {
            val tree = Uri.parse(folder)
            val doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
            ctx.contentResolver.query(doc, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null).use { c ->
                promise.resolve(if (c != null && c.moveToFirst()) c.getString(0) else null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    /** Gives the folder's permission back (the automatic copies turned off). */
    @ReactMethod
    fun releaseFolder(folder: String, promise: Promise) {
        try {
            ctx.contentResolver.releasePersistableUriPermission(
                Uri.parse(folder), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        } catch (e: Exception) { /* not held any more */ }
        promise.resolve(true)
    }

    /**
     * Writes the file `name` of the files dir into the folder as `title` (a new file: an older copy is never written
     * over), then deletes all but the newest `keep` files whose names start with `prefix`. Deletes the source file.
     */
    @ReactMethod
    fun saveToFolder(folder: String, name: String, title: String, prefix: String, keep: Int, promise: Promise) {
        Thread {
            val source = File(ctx.filesDir, name)
            try {
                val tree = Uri.parse(folder)
                val treeId = DocumentsContract.getTreeDocumentId(tree)
                val parent = DocumentsContract.buildDocumentUriUsingTree(tree, treeId)
                val created = DocumentsContract.createDocument(ctx.contentResolver, parent, "application/octet-stream", title)
                    ?: throw IllegalStateException("Can't create $title")
                ctx.contentResolver.openOutputStream(created, "w")!!.use { out -> source.inputStream().use { it.copyTo(out) } }
                // the older copies, the newest first by name (the date is in it)
                val copies = mutableListOf<Pair<String, String>>()
                val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, treeId)
                ctx.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
                    while (c.moveToNext()) {
                        val n = c.getString(1) ?: continue
                        if (n.startsWith(prefix)) copies.add(Pair(n, c.getString(0)))
                    }
                }
                copies.sortedByDescending { it.first }.drop(keep).forEach { (_, id) ->
                    DocumentsContract.deleteDocument(ctx.contentResolver, DocumentsContract.buildDocumentUriUsingTree(tree, id))
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("E_AUTO_BACKUP", e)
            } finally {
                source.delete()
            }
        }.start()
    }

    /** Deletes a file of the files dir (a copy left from an interrupted backup: VACUUM INTO needs the name free). */
    @ReactMethod
    fun deleteFile(name: String, promise: Promise) {
        promise.resolve(File(ctx.filesDir, name).delete())
    }

    /**
     * Puts the file `source` (checked, see checkBackup) in place of the database `db` (closed by JS first), keeping the
     * old one as `<db>.before-restore`, and restarts the JS: every screen and cache starts on the restored data.
     */
    @ReactMethod
    fun replaceDatabase(source: String, db: String, promise: Promise) {
        try {
            val dir = ctx.filesDir
            val current = File(dir, db)
            if (current.exists()) current.copyTo(File(dir, "$db.before-restore"), overwrite = true)
            File(dir, source).copyTo(current, overwrite = true)
            File(dir, source).delete()
            for (suffix in listOf("-journal", "-wal", "-shm")) File(dir, db + suffix).delete()
            promise.resolve(true)
            Handler(Looper.getMainLooper()).post {
                (ctx.applicationContext as ReactApplication).reactNativeHost.reactInstanceManager.recreateReactContextInBackground()
            }
        } catch (e: Exception) {
            promise.reject("E_RESTORE", e)
        }
    }

    private fun ask(intent: Intent, promise: Promise, onCancel: () -> Unit, onPicked: (Uri) -> Any) {
        val activity = currentActivity ?: return promise.reject("E_NO_ACTIVITY", "No activity")
        if (pending != null) return promise.reject("E_BUSY", "A file dialog is already open")
        pending = Pending(promise, onPicked, onCancel)
        activity.startActivityForResult(intent, REQUEST)
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST) return
        val p = pending ?: return
        pending = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            p.onCancel()
            p.promise.resolve(false)
            return
        }
        // the copy off the main thread: a database of a few megabytes
        Thread {
            try {
                p.promise.resolve(p.onPicked(uri))
            } catch (e: Exception) {
                p.promise.reject("E_FILE", e)
            }
        }.start()
    }

    override fun onNewIntent(intent: Intent?) {}

    companion object {
        private const val REQUEST = 4201
    }
}

class BackupPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(BackupModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
