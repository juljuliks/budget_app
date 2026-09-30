package com.budgetapp

import android.os.Bundle
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
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled,
            DefaultNewArchitectureEntryPoint.concurrentReactEnabled
        )
}
