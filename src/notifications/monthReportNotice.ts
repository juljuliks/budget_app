import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { isCurrency } from '../db/fx';
import { currentYm, MonthClose, monthClose, parseYm, planConverter, ymOf } from '../db/plans';
import { monthReport, yearly } from '../db/report';
import { getSetting } from '../db/settings';
import { formatWithCurrency } from '@/shared/lib/money';
import { MONTHS_GEN, MONTHS_NOM } from '@/shared/lib/dates';
import { hideNotificationAmounts } from '../native/appLock';

/** «Отчёты»: the month's report on the 1st (its "Итоги" instead, when it has questions) */
export const REPORTS_CHANNEL_ID = 'reports';
export const REPORT_ACTION = 'month_report';
/** "Скрывать суммы в уведомлениях" (Блокировка): the body instead of the amounts */
export const AMOUNTS_HIDDEN = 'Суммы — в приложении';
/** the hour of the 1st the report comes at */
const REPORT_HOUR = 10;


/**
 * "Итоги сентября — удалось отложить?": what the month asks — the overspend to cover, or what goes to savings and the
 * funds as planned (in the budget's currency).
 */
async function closeBody(c: MonthClose): Promise<string> {
  const b = c.budget;
  const cur = b?.currency ?? c.funds[0]?.currency ?? 'GEL';
  const money = (v: number) => formatWithCurrency(Math.round(v), cur);
  if (b && b.over_minor > 0) return `Бюджет превышен на ${money(b.over_minor)} — чем покрыть?`;
  const conv = await planConverter(c.ym);
  const funds = c.funds.reduce((a, f) => a + (conv(f.planned_minor, f.currency, cur) ?? 0), 0);
  const savings = b ? b.kept_locked_minor + b.rest_minor : 0;
  return [savings > 0 ? `В сбережения по плану ${money(savings)}` : '', funds > 0 ? `в копилки ${money(funds)}` : '']
    .filter(Boolean).join(', ').replace(/^в/, 'В');
}

/** 10:00 on the 1st after the month `ym`. */
function reportTime(ym: string): number {
  const { year, month } = parseYm(ym);
  return new Date(year, month + 1, 1, REPORT_HOUR).getTime();
}

/**
 * The report notification of the month, at 10:00 on the 1st after it, with what is put aside so far. Re-scheduled on
 * every change of the operations (the last one of the month wins); the previous month's too while its time hasn't
 * come (an SMS of the 31st arriving on the 1st). Never throws.
 */
export async function scheduleMonthReports(now = new Date()) {
  try {
    const cur = currentYm(now);
    const { year, month } = parseYm(cur);
    const prev = month === 0 ? ymOf(year - 1, 11) : ymOf(year, month - 1);
    const stored = await getSetting('display_currency');
    const currency = isCurrency(stored) ? stored : 'GEL';
    const hide = await hideNotificationAmounts();
    for (const ym of [prev, cur]) {
      const at = reportTime(ym);
      if (at <= now.getTime()) continue;
      // the month will have "Итоги" to answer (as on the 1st): they come instead of the report
      const { year: y, month: m } = parseYm(ym);
      const close = await monthClose(ym, ymOf(y, m + 1));
      if (close.steps.length && !close.closed) {
        await notifee.createTriggerNotification({
          id: `report_${ym}`,
          title: `Итоги ${MONTHS_GEN[m]} — удалось отложить?`,
          body: hide ? AMOUNTS_HIDDEN : await closeBody(close),
          android: {
            channelId: REPORTS_CHANNEL_ID, smallIcon: 'ic_notification', importance: AndroidImportance.DEFAULT,
            pressAction: { id: REPORT_ACTION, launchActivity: 'default' },
          },
          data: { kind: 'close', ym },
        }, { type: TriggerType.TIMESTAMP, timestamp: at });
        continue;
      }
      const r = await monthReport(ym, currency);
      // no plan that month (or it was removed since): no report
      if (!r.hasPlan) { await notifee.cancelTriggerNotification(`report_${ym}`); continue; }
      const money = (v: number) => formatWithCurrency(Math.round(v), currency);
      const body = hide ? AMOUNTS_HIDDEN : r.saved === null ? `Потрачено ${money(r.spent)}`
        : r.saved < 0 ? `Бюджет превышен на ${money(-r.saved)}${r.overInBudget ? ` (${formatWithCurrency(Math.round(r.overInBudget.minor), r.overInBudget.currency)})` : ''}`
          : `Отложено ${money(r.saved)} (≈ ${money(yearly(r.saved))} за год)${r.couldSaveMore > 0 ? `. Могли ещё ${money(r.couldSaveMore)}` : ''}`;
      await notifee.createTriggerNotification({
        // one per month: re-scheduling replaces it
        id: `report_${ym}`,
        title: `Отчёт за ${MONTHS_NOM[parseYm(ym).month]}`,
        body,
        android: {
          channelId: REPORTS_CHANNEL_ID,
          smallIcon: 'ic_notification',
          importance: AndroidImportance.DEFAULT,
          pressAction: { id: REPORT_ACTION, launchActivity: 'default' },
        },
        data: { kind: 'report', ym },
      }, { type: TriggerType.TIMESTAMP, timestamp: at });
    }
  } catch (e) {
    console.error('schedule month report failed', e);
  }
}
