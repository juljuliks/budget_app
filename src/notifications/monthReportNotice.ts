import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { isCurrency } from '../db/fx';
import { currentYm, parseYm, ymOf } from '../db/plans';
import { monthReport, yearly } from '../db/report';
import { getSetting } from '../db/settings';
import { formatWithCurrency } from '../ui/money';

/** «Отчёты»: the month's report on the 1st */
export const REPORTS_CHANNEL_ID = 'reports';
export const REPORT_ACTION = 'month_report';
/** the hour of the 1st the report comes at */
const REPORT_HOUR = 10;

const MONTHS_FOR = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

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
    for (const ym of [prev, cur]) {
      const at = reportTime(ym);
      if (at <= now.getTime()) continue;
      const r = await monthReport(ym, currency);
      if (r.spent <= 0 && r.saved === null) continue; // nothing happened that month
      const money = (v: number) => formatWithCurrency(Math.round(v), currency);
      const body = r.saved === null ? `Потрачено ${money(r.spent)}`
        : r.saved < 0 ? `Бюджет превышен на ${money(-r.saved)}`
          : `Отложено ${money(r.saved)} (≈ ${money(yearly(r.saved))} за год)${r.couldSaveMore > 0 ? `. Могли ещё ${money(r.couldSaveMore)}` : ''}`;
      await notifee.createTriggerNotification({
        // one per month: re-scheduling replaces it
        id: `report_${ym}`,
        title: `Отчёт за ${MONTHS_FOR[parseYm(ym).month]}`,
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
