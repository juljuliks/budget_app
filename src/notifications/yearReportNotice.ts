// «Итоги 2026» on 1 January at 10:00: what the year put aside. Re-scheduled with the month's report on every change of the
// operations (the last one of the year wins).
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import type { Currency } from '../db/fx';
import { yearReport } from '../db/yearReport';
import { formatWithCurrency } from '@/shared/lib/money';
import { AMOUNTS_HIDDEN, REPORT_ACTION, REPORTS_CHANNEL_ID } from './monthReportNotice';

/** 10:00 on 1 January after `year`. */
export const yearReportTime = (year: number) => new Date(year + 1, 0, 1, 10).getTime();

/** The notice of `year`: «Итоги 2026» — «Отложено 9 132 ₾ за год · 16% бюджета». */
export async function yearNotice(
  year: number,
  currency: Currency,
  hide: boolean,
): Promise<{ title: string; body: string } | null> {
  const r = await yearReport(year, currency, `${year}-12`);
  if (!r.count) return null;
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency);
  // «Отложено» in the budget currency of the year's last month with one
  const saved = (v: number) =>
    formatWithCurrency(Math.round(r.savedIn ? v * r.savedIn.rate : v), r.savedIn?.currency ?? r.currency);
  const share = r.budget > 0 ? ` · ${Math.round((r.saved / r.budget) * 100)}% бюджета` : '';
  return {
    title: `Итоги ${year}`,
    body: hide
      ? AMOUNTS_HIDDEN
      : r.budget > 0
        ? `Отложено ${saved(r.saved)} за год${share}`
        : `Потрачено за год ${money(r.spent)}`,
  };
}

/** Schedules the current year's notice (nothing to say — cancelled). */
export async function scheduleYearReport(now: Date, currency: Currency, hide: boolean) {
  const year = now.getFullYear();
  const notice = await yearNotice(year, currency, hide);
  if (!notice) {
    await notifee.cancelTriggerNotification(`year_${year}`);
    return;
  }
  await notifee.createTriggerNotification(
    {
      id: `year_${year}`,
      ...notice,
      android: {
        channelId: REPORTS_CHANNEL_ID,
        smallIcon: 'ic_notification',
        importance: AndroidImportance.DEFAULT,
        pressAction: { id: REPORT_ACTION, launchActivity: 'default' },
      },
      data: { kind: 'year', year: String(year) },
    },
    { type: TriggerType.TIMESTAMP, timestamp: yearReportTime(year) },
  );
}
