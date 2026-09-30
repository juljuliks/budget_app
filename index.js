import { AppRegistry } from 'react-native';
import App from './src/App';
import SmsBackgroundTask from './src/native/SmsBackgroundTask';
// Registers notifee.onBackgroundEvent; must run at startup, before any UI
import './src/notifications/notifeeBootstrap';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
// Task key must match SmsHeadlessService.TASK_KEY on the Kotlin side
AppRegistry.registerHeadlessTask('SmsBackgroundTask', () => SmsBackgroundTask);
