package com.budgetapp

import android.content.Intent
import android.os.Bundle
import com.budgetapp.update.UpdateNotices
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
    // Must match the name registered via AppRegistry.registerComponent in index.js
    override fun getMainComponentName(): String = "BudgetApp"

    // react-native-screens: don't restore fragments after process death, it crashes
    // (https://github.com/software-mansion/react-native-screens#android)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        UpdateNotices.takeIntent(intent)
        // the app opened: «Обновлено до» and an installed version's «Доступна» are done with
        UpdateNotices.clearStale(this, opened = true)
    }

    // singleTask: a notification tapped while the app is alive comes here; kept as the activity's intent so that
    // notifee.getInitialNotification() (asked again when the app comes back) sees it, not the launch's
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        UpdateNotices.takeIntent(intent)
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled,
            DefaultNewArchitectureEntryPoint.concurrentReactEnabled
        )
}
