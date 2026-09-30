import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { handleNotificationAction, CHANNEL_ID } from './notifeeIntegration';

export async function createNotificationChannel() {
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Transactions',
      importance: AndroidImportance.HIGH,
    });
  } catch (e) {
    // ignore on non-Android or if not available during tests
  }
}

// Background event handler — Notifee will invoke this in a headless context
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    // PRESS = tap on the notification body, ACTION_PRESS = tap on an action button
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      await handleNotificationAction({ id: detail.pressAction?.id, notification: detail.notification });
    }
  } catch (err) {
    // don't crash the background handler, but keep the error visible in logcat
    console.error('notifee background action failed', err);
  }
});

export default { createNotificationChannel };
