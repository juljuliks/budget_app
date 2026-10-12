package com.budgetapp.sms

import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ViewManager

/**
 * The banks whose SMS and pushes are read (the same patterns as src/domain/banks.ts), and which of them are on
 * (Настройки → "Банки", kept here too: SMS come while the app is closed). Nothing else reaches JS: personal SMS and
 * other apps' notifications are dropped right where they arrive.
 */
object BankSources {
    private class Bank(val id: String, val sms: Regex, val app: (String) -> Boolean)

    private val BANKS = listOf(
        // "TBC SMS" in real SMS; deliberately no phone-number patterns
        Bank("tbc", Regex("""^TBC ?(SMS|BANK)?$""", RegexOption.IGNORE_CASE)) { it.lowercase().contains("tbc") },
        // not confirmed against a real SMS yet
        Bank("bog", Regex("""^(BOG|BANK ?OF ?GEORGIA)$""", RegexOption.IGNORE_CASE)) { it.lowercase().startsWith("ge.bog") },
    )

    private const val PREFS = "bank_sources"
    private const val KEY = "enabled"

    private fun enabled(ctx: Context): Set<String> =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY, null) ?: setOf("tbc")

    fun setEnabled(ctx: Context, ids: Set<String>) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY, ids).apply()
    }

    fun isBankSender(ctx: Context, sender: String): Boolean {
        val on = enabled(ctx)
        return BANKS.any { it.id in on && it.sms.matches(sender.trim()) }
    }

    fun isBankApp(ctx: Context, pkg: String?): Boolean {
        if (pkg == null) return false
        val on = enabled(ctx)
        return BANKS.any { it.id in on && it.app(pkg) }
    }
}

/** JS side: the banks on, after a change in "Банки" (and on every start, in case they drifted). */
class BankSourcesModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "BankSources"

    @ReactMethod
    fun setEnabled(ids: ReadableArray) {
        BankSources.setEnabled(ctx, (0 until ids.size()).mapNotNull { ids.getString(it) }.toSet())
    }
}

class BankSourcesPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> = listOf(BankSourcesModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
