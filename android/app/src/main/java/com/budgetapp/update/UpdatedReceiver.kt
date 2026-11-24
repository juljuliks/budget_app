package com.budgetapp.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.budgetapp.BuildConfig

/**
 * This app replaced by a newer build (its own «Обновить», or any install over it): «Обновлено до 1.0.N» — a notification
 * that opens it (Android doesn't let an app open itself from the background). A local build ("1.0-dev") says nothing.
 */
class UpdatedReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (UpdateNotices.parseVersion(BuildConfig.VERSION_NAME) == null) return
        UpdateNotices.notifyUpdated(ctx, BuildConfig.VERSION_NAME)
    }
}
