// What the app does once on start: the notification channel and permissions, the refunds' categories, the notification
// that opened the app and the ones pressed while it is open, the month reports, the weekly automatic copy, a newer
// release.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import { createNotificationChannel } from '@/notifications/notifeeBootstrap';
import { scheduleMonthReports } from '@/notifications/monthReportNotice';
import { notifyFundsLate } from '@/notifications/fundLateNotice';
import { handleNotificationAction } from '@/notifications/notifeeIntegration';
import { requestAppPermissions } from '@/native/permissions';
import { emitTransactionsChanged, onTransactionsChanged } from '@/domain/events';
import { autoCategorizeRefunds } from '@/db/refunds';
import { flushPendingNavigation } from '@/shared/navigation/navigation';
import { runAutoBackupIfDue } from '@/features/backup';
import { syncNativeBanks } from '@/features/banks';
import { offerUpdate } from '@/features/app-update';
import { syncRemoteTemplates } from '@/features/message-templates';

/** The notifications already acted on: the activity keeps the intent it was opened with, asked again on every return. */
const handled = new Set<string>();

/** The notification the app was opened or brought back with, acted on once. */
function openedByNotification() {
  notifee.getInitialNotification()
    .then((initial) => {
      // a return without a notification: nothing pressed
      if (!initial?.pressAction || !initial.notification) return;
      const key = `${initial.notification.id ?? ''}|${initial.pressAction.id}`;
      if (handled.has(key)) return;
      handled.add(key);
      return handleNotificationAction({ id: initial.pressAction.id, notification: initial.notification });
    })
    .catch((e) => console.error('initial notification failed', e));
}

export function useAppStartup() {
  useEffect(() => {
    createNotificationChannel();
    // which banks' SMS and pushes the native side lets through
    syncNativeBanks().catch((e) => console.error('banks sync failed', e));
    requestAppPermissions().catch(() => {});
    // refunds that came before their merchant had a category (or before this existed) get one
    autoCategorizeRefunds().then((n) => { if (n > 0) emitTransactionsChanged(); }).catch((e) => console.error('refund categories failed', e));

    // app was launched (or brought back: a scheduled one, shown by WorkManager, gives no press event then) by tapping a
    // notification / its action button
    openedByNotification();

    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        // the same press isn't acted on again when the app comes back with its intent
        handled.add(`${detail.notification?.id ?? ''}|${detail.pressAction?.id}`);
        handleNotificationAction({ id: detail.pressAction?.id, notification: detail.notification })
          .catch((e) => console.error('notification action failed', e));
      }
    });

    // the month's report on the 1st: scheduled now and re-scheduled after every change of the operations
    scheduleMonthReports();
    // a fund that stopped making it while the app was closed (a new month, the spending)
    notifyFundsLate();
    // a fund that stopped making it by its date: said once (the plan, the budget, the % of 🔒 changed it)
    const offReport = onTransactionsChanged(() => { scheduleMonthReports(); notifyFundsLate(); });

    // the weekly automatic copy, if it is on and due: on start and on coming back (the app is seldom started anew)
    runAutoBackupIfDue();
    // a newer release on GitHub: a toast with «Обновить», once per version (asked at most every few hours)
    offerUpdate();
    // the bank's templates from Remote Config (a new message format read without a release)
    syncRemoteTemplates();
    // a press handled by the background handler may have queued a screen while we were in background
    const appState = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      openedByNotification();
      flushPendingNavigation();
      runAutoBackupIfDue();
      offerUpdate();
    });

    return () => { unsubscribe(); appState.remove(); offReport(); };
  }, []);
}
