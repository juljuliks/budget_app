package com.budgetapp.update

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Once a day, with the app closed too, the fallback of the release's push (ReleasePushService: lost, or no Google
 * services): GitHub's latest release (as src/update/releases.ts asks it) — «Доступна версия 1.0.N» by UpdateNotices'
 * rules (newer, once per version).
 */
class UpdateCheckWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        return try {
            latestVersion()?.let { UpdateNotices.notifyAvailable(applicationContext, it) }
            Result.success()
        } catch (e: Exception) {
            // no network, GitHub down: tomorrow's run asks again
            Result.success()
        }
    }

    /** The latest release's version, if it has an APK. */
    private fun latestVersion(): String? {
        val conn = URL(LATEST_RELEASE_URL).openConnection() as HttpURLConnection
        conn.setRequestProperty("Accept", "application/vnd.github+json")
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        try {
            if (conn.responseCode != 200) return null
            val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
            val assets = json.optJSONArray("assets") ?: return null
            val hasApk = (0 until assets.length()).any { assets.getJSONObject(it).optString("name").endsWith(".apk") }
            return if (hasApk) json.optString("tag_name").removePrefix("v").ifEmpty { null } else null
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        const val LATEST_RELEASE_URL = "https://api.github.com/repos/juljuliks/budget_app/releases/latest"
        private const val WORK_NAME = "update-check"

        /** The daily check scheduled (kept as it is when it already is). */
        fun schedule(ctx: Context) {
            val request = PeriodicWorkRequestBuilder<UpdateCheckWorker>(1, TimeUnit.DAYS)
                // not on the first start: the app is open then, its toast says it
                .setInitialDelay(1, TimeUnit.DAYS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
