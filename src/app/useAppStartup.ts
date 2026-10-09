// What the app does once on start: the notification channel and permissions, the refunds' categories, the notification
// that opened the app and the ones pressed while it is open, the month reports.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import { createNotificationChannel } from '@/notifications/notifeeBootstrap';
import { scheduleMonthReports } from '@/notifications/monthReportNotice';
import { handleNotificationAction } from '@/notifications/notifeeIntegration';
import { requestAppPermissions } from '@/permissions';
import { emitTransactionsChanged, onTransactionsChanged } from '@/events';
import { autoCategorizeRefunds } from '@/db/refunds';
import { flushPendingNavigation } from '@/shared/navigation/navigation';

export function useAppStartup() {
  useEffect(() => {
    createNotificationChannel();
    requestAppPermissions().catch(() => {});
    // refunds that came before their merchant had a category (or before this existed) get one
    autoCategorizeRefunds().then((n) => { if (n > 0) emitTransactionsChanged(); }).catch((e) => console.error('refund categories failed', e));

    // app was launched by tapping a notification / its action button
    notifee.getInitialNotification()
      .then((initial) => initial && handleNotificationAction({ id: initial.pressAction.id, notification: initial.notification }))
      .catch((e) => console.error('initial notification failed', e));

    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        handleNotificationAction({ id: detail.pressAction?.id, notification: detail.notification })
          .catch((e) => console.error('notification action failed', e));
      }
    });

    // the month's report on the 1st: scheduled now and re-scheduled after every change of the operations
    scheduleMonthReports();
    const offReport = onTransactionsChanged(() => { scheduleMonthReports(); });

    // a press handled by the background handler may have queued a screen while we were in background
    const appState = AppState.addEventListener('change', (s) => { if (s === 'active') flushPendingNavigation(); });

    return () => { unsubscribe(); appState.remove(); offReport(); };
  }, []);
}
