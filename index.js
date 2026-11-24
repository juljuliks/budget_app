import { AppRegistry } from 'react-native';
import { installCrashReporting } from './src/native/crashReport';
import App from './src/app/App';
import SmsBackgroundTask from './src/native/SmsBackgroundTask';
// Registers notifee.onBackgroundEvent; must run at startup, before any UI
import './src/notifications/notifeeBootstrap';
import { name as appName } from './app.json';

// crash reports (Crashlytics): before anything can fail
installCrashReporting();

AppRegistry.registerComponent(appName, () => App);
// Task key must match SmsHeadlessService.TASK_KEY on the Kotlin side
AppRegistry.registerHeadlessTask('SmsBackgroundTask', () => SmsBackgroundTask);
