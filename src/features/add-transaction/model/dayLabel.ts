import { DayKey, dayKeyOf, parseDayKey } from '@/shared/lib/dateRange';
import { MONTHS_GEN } from '@/shared/lib/dates';

/** "Сегодня, 5 октября" / "Вчера, 4 октября" / "28 сентября" / "28 сентября 2025" */
export function dayLabel(day: DayKey, now = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const d = parseDayKey(day);
  const date = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  return day === dayKeyOf(now) ? `Сегодня, ${date}` : day === dayKeyOf(yesterday) ? `Вчера, ${date}` : date;
}
