package com.budgetapp.update

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.budgetapp.BuildConfig
import com.budgetapp.MainActivity
import com.budgetapp.R

/**
 * The app's notices about its own versions: «Доступна версия 1.0.N» (from the release's push, ReleasePushService, or the
 * daily check, UpdateCheckWorker) and «Обновлено до 1.0.N» after it was replaced (UpdatedReceiver). «Доступна» — once
 * per version and not more often than once a day; a version the toast on start said (AppUpdateModule.markOffered) — not
 * again. Its tap opens the app with [ACTION_EXTRA] = [ACTION_UPDATE]: «Обновить» at once (AppUpdateModule.takeLaunchAction).
 */
object UpdateNotices {
    const val ACTION_EXTRA = "budget_action"
    const val ACTION_UPDATE = "update"
    private const val CHANNEL_ID = "updates"
    private const val AVAILABLE_ID = 4201
    private const val UPDATED_ID = 4202
    private const val PREFS = "app_update"
    private const val OFFERED = "offered"
    private const val NOTIFIED_AT = "notified_at"
    /** «Доступна» at most this often (a day, a few hours' slack for the daily check's drift) */
    private const val MIN_GAP_MS = 20L * 3600_000

    /** Opened by the notification: kept till JS takes it (AppUpdateModule.takeLaunchAction), once. */
    @Volatile var pendingAction: String? = null

    /** MainActivity's intent (a start or a return): its action kept, taken off the intent. */
    fun takeIntent(intent: Intent?) {
        val action = intent?.getStringExtra(ACTION_EXTRA) ?: return
        intent.removeExtra(ACTION_EXTRA)
        pendingAction = action
    }

    /** "1.0.42" → [1, 0, 42]; a local build ("1.0-dev") → null: it is never offered an update. */
    fun parseVersion(v: String): List<Int>? {
        val m = Regex("^v?(\\d+(?:\\.\\d+)*)$").find(v.trim()) ?: return null
        return m.groupValues[1].split('.').map { it.toInt() }
    }

    private fun compare(a: List<Int>, b: List<Int>): Int {
        for (i in 0 until maxOf(a.size, b.size)) {
            val d = a.getOrElse(i) { 0 } - b.getOrElse(i) { 0 }
            if (d != 0) return d
        }
        return 0
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun offered(ctx: Context): String? = prefs(ctx).getString(OFFERED, null)

    fun markOffered(ctx: Context, version: String) {
        prefs(ctx).edit().putString(OFFERED, version).apply()
    }

    /**
     * «Доступна версия [version]», if it is newer than this build, not said yet, and nothing was said for a day; true —
     * said. A skipped one is said by the next day's check (it asks the latest).
     */
    fun notifyAvailable(ctx: Context, version: String, now: Long = System.currentTimeMillis()): Boolean {
        val current = parseVersion(BuildConfig.VERSION_NAME) ?: return false
        val latest = parseVersion(version) ?: return false
        val p = prefs(ctx)
        if (compare(latest, current) <= 0 || p.getString(OFFERED, null) == version) return false
        if (now - p.getLong(NOTIFIED_AT, 0) < MIN_GAP_MS) return false
        post(ctx, AVAILABLE_ID, "Доступна версия $version", "Нажмите, чтобы обновить приложение", update = true)
        p.edit().putString(OFFERED, version).putLong(NOTIFIED_AT, now).apply()
        return true
    }

    /**
     * The notices done with: «Доступна версия» of a version installed now (or older) — on every start of the app's
     * process, the first one after an update too; «Обновлено до» too when the app is [opened].
     */
    fun clearStale(ctx: Context, opened: Boolean) {
        val nm = NotificationManagerCompat.from(ctx)
        val current = parseVersion(BuildConfig.VERSION_NAME)
        val said = prefs(ctx).getString(OFFERED, null)?.let { parseVersion(it) }
        if (current != null && said != null && compare(said, current) <= 0) nm.cancel(AVAILABLE_ID)
        if (opened) nm.cancel(UPDATED_ID)
    }

    /** «Обновлено до [version]»: the app closed by its update, a tap opens it again. */
    fun notifyUpdated(ctx: Context, version: String) {
        NotificationManagerCompat.from(ctx).cancel(AVAILABLE_ID)
        post(ctx, UPDATED_ID, "Обновлено до $version", "Нажмите, чтобы открыть приложение", update = false)
    }

    private fun post(ctx: Context, id: Int, title: String, text: String, update: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Обновления", NotificationManager.IMPORTANCE_DEFAULT)
            ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (update) open.putExtra(ACTION_EXTRA, ACTION_UPDATE)
        val tap = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tap)
            .setAutoCancel(true)
        if (update) builder.addAction(0, "Обновить", tap)
        try {
            NotificationManagerCompat.from(ctx).notify(id, builder.build())
        } catch (e: SecurityException) {
            // notifications not allowed: nothing to say it with
        }
    }
}
