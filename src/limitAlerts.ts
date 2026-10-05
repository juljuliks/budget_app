import { getSetting, setSetting } from './db/settings';
import { Currency, isCurrency } from './db/fx';
import { BUDGET_CURRENCY } from './db/plans';
import { DayKey, dayKeyOf, daysInMonth, shortRange } from './ui/dateRange';
import { loadNorms } from './ui/stats/norms';
import { plural } from './ui/format';
import { formatWithCurrency } from './ui/money';
import { FOR_PERIOD } from './ui/strings';

// Notifications when a category's spending comes near its limit: 80% and 100% of the month's plan and of the
// limit of its rhythm (a day / week / 2 weeks, the one shown in the period stats). Each threshold once — per month
// for the plan, per rhythm window for the limit — remembered in app_settings. Only "траты с лимитом".

/** Настройки → «Уведомлять о лимитах»; on unless turned off. */
export const LIMIT_ALERTS_SETTING = 'limit_alerts';

export async function limitAlertsEnabled(): Promise<boolean> {
  return (await getSetting(LIMIT_ALERTS_SETTING)) !== 'off';
}

export async function setLimitAlertsEnabled(on: boolean) {
  await setSetting(LIMIT_ALERTS_SETTING, on ? 'on' : 'off');
}

const THRESHOLDS = [100, 80] as const;
type Level = typeof THRESHOLDS[number];

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** The highest threshold reached: 100, 80 or null. */
function levelOf(spent: number, limit: number): Level | null {
  if (limit <= 0) return null;
  return THRESHOLDS.find((t) => spent * 100 >= limit * t) ?? null;
}

/** A threshold not notified yet under `key`: marks it (and every lower one) as notified. */
async function newLevel(key: string, level: Level | null): Promise<Level | null> {
  if (level === null) return null;
  const done = Number(await getSetting(key) ?? 0);
  if (level <= done) return null;
  await setSetting(key, String(level));
  return level;
}

export type LimitAlert = { title: string; body: string };

/**
 * After an operation of this month got `categoryId`: the notification to show, if its spending just reached 80% or
 * 100% of the month's plan or of its rhythm's limit for the first time. The month at 100% wins over the rhythm at
 * 100%, then the month at 80%, then the rhythm at 80%; every reached threshold is remembered, so the others don't
 * come with the next operation.
 */
export async function limitAlertFor(categoryId: number, now = new Date()): Promise<LimitAlert | null> {
  if (!(await limitAlertsEnabled())) return null;
  const stored = await getSetting('display_currency');
  const currency: Currency = isCurrency(stored) ? stored : BUDGET_CURRENCY;
  const today: DayKey = dayKeyOf(now);
  const norms = await loadNorms({ from: today, to: today }, currency);
  const c = norms.byCategory.get(categoryId);
  if (!c || c.kind !== 'limit') return null;

  const ym = norms.ym;
  const monthSpent = norms.monthToDate.get(categoryId) ?? 0;
  const month = await newLevel(`limit_alert:m:${ym}:${categoryId}`, levelOf(monthSpent, c.monthLimit));
  const rhythm = c.rhythm === 'month'
    ? null
    : await newLevel(`limit_alert:w:${c.window.from}:${categoryId}`, levelOf(c.windowSpent, c.windowNorm));
  const money = (minor: number) => formatWithCurrency(Math.round(minor), currency);
  const monthName = MONTHS[Number(ym.slice(5, 7)) - 1];

  if (month === 100 || (month === 80 && rhythm !== 100)) {
    const left = c.monthLimit - monthSpent;
    const daysLeft = daysInMonth(ym) - now.getDate() + 1;
    return month === 100
      ? {
        title: `${c.name} — план на ${monthName} превышен`,
        body: `Потрачено ${money(monthSpent)} из ${money(c.monthLimit)}, перерасход ${money(-left)}`,
      }
      : {
        title: `${c.name} — 80% плана на ${monthName}`,
        body: `Потрачено ${money(monthSpent)} из ${money(c.monthLimit)}, осталось ${money(left)} на ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}`,
      };
  }
  if (rhythm !== null && c.rhythm !== 'month') {
    const period = FOR_PERIOD[c.rhythm];
    const when = c.rhythm === 'day' ? 'Сегодня' : `${shortRange(c.window)}:`;
    const spent = `${when} потрачено ${money(c.windowSpent)} из ${money(c.windowNorm)}`;
    return rhythm === 100
      ? { title: `${c.name} — лимит ${period} превышен`, body: spent }
      : { title: `${c.name} — 80% лимита ${period}`, body: `${spent}, осталось ${money(c.windowNorm - c.windowSpent)}` };
  }
  return null;
}
