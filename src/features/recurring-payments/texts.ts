// The repeating payments' words: the periods, "через 7 дней", the days.
import { SHORT_MONTHS } from '@/shared/lib/dates';
export { inMonth, inMonthYear, longDay, longDayYear, monthGen, monthGenYear } from '@/shared/lib/dates';
export { periodText } from '@/shared/lib/format';
import { plural } from '@/shared/lib/format';

const parts = (day: string) => day.split('-').map(Number);

/** "25 окт"; another year — "12 мар 2027". */
export function shortDay(day: string, now = new Date()): string {
  const [y, m, d] = parts(day);
  return `${d} ${SHORT_MONTHS[m - 1]}${y === now.getFullYear() ? '' : ` ${y}`}`;
}

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
