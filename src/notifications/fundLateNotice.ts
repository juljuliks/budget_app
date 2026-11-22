// A fund that stopped making it by its date (it did before, or is new): "🏖 Отпуск не успевает к 31 июля 2027" — once,
// till it makes it again. Checked after every change of the data (the plan, the budget, the % of 🔒, a fund).
import notifee, { AndroidImportance } from '@notifee/react-native';
import { categoryLabel, listCategories } from '../db/categories';
import { hideNotificationAmounts } from '../native/appLock';
import { fundLateNotice, newlyLate } from './fundLate';
import { REPORTS_CHANNEL_ID } from './monthReportNotice';

export const FUND_ACTION = 'fund';

let checking: Promise<void> = Promise.resolve();

/** Shown for each fund that stopped making it. One check at a time; never throws. */
export function notifyFundsLate(): Promise<void> {
  checking = checking.then(async () => {
    try {
      const fresh = await newlyLate();
      if (!fresh.size) return;
      const hide = await hideNotificationAmounts();
      const cats = await listCategories();
      for (const f of fresh.values()) {
        const c = cats.find((x) => x.id === f.category_id);
        await notifee.displayNotification({
          id: `fund_late_${f.category_id}`,
          ...fundLateNotice(c ? categoryLabel(c) : 'Копилка', f, hide),
          android: { channelId: REPORTS_CHANNEL_ID, smallIcon: 'ic_notification', importance: AndroidImportance.DEFAULT, pressAction: { id: FUND_ACTION, launchActivity: 'default' } },
          data: { categoryId: String(f.category_id) },
        });
      }
    } catch (e) {
      console.error('fund late notice failed', e);
    }
  });
  return checking;
}
