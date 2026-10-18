// The subscriptions' words: the periods, "через 7 дней", the days.
import { MONTHS_GEN, MONTHS_PREP, SHORT_MONTHS } from '@/shared/lib/dates';
export { periodText } from '@/shared/lib/format';
import { plural } from '@/shared/lib/format';

/** The period chips: months and their names; another — "Другое…". */
export const PERIODS: ReadonlyArray<readonly [number, string]> = [[1, 'Каждый месяц'], [3, 'Раз в 3 месяца'], [6, 'Раз в полгода'], [12, 'Раз в год']];

const parts = (day: string) => day.split('-').map(Number);

/** "25 окт"; another year — "12 мар 2027". */
export function shortDay(day: string, now = new Date()): string {
  const [y, m, d] = parts(day);
  return `${d} ${SHORT_MONTHS[m - 1]}${y === now.getFullYear() ? '' : ` ${y}`}`;
}

/** "18 октября". */
export const longDay = (day: string) => { const [, m, d] = parts(day); return `${d} ${MONTHS_GEN[m - 1]}`; };

/** "в октябре" of 'YYYY-MM'. */
export const inMonth = (ym: string) => `в ${MONTHS_PREP[Number(ym.slice(5)) - 1]}`;

/** "октября" of 'YYYY-MM'. */
export const monthGen = (ym: string) => MONTHS_GEN[Number(ym.slice(5)) - 1];

/** "сегодня", "завтра", "через 7 дней", "через месяц", "через 5 месяцев"; past — null. */
export function inTime(day: string, today: string): string | null {
  const [y, m, d] = parts(day);
  const [ty, tm, td] = parts(today);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 28) return `через ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
  const months = Math.max(1, Math.round(days / 30.4));
  return months === 1 ? 'через месяц' : `через ${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`;
}
