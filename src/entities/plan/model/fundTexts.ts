// A fund's lines: how far along it is, by when, what is put in a month.
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { dayTitle } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';

/** saved the whole target */
export const isSaved = (saved: number, target: number) => saved >= target;

/** "1 200 из 3 000 ₾ · к 31 июля 2027"; saved up — "1 500 из 1 500 ₾ · накоплено". */
export function fundProgress(saved: number, target: number, due: string, currency: string): string {
  return `${formatShort(saved)} из ${formatWithCurrency(target, currency)} · ${isSaved(saved, target) ? 'накоплено' : `к ${dayTitle(due)}`}`;
}

/** "ещё 9 взносов" — the months after `ym` up to the due one; none — "". */
export function contributionsLeft(left: number): string {
  return left > 0 ? `ещё ${left} ${plural(left, ['взнос', 'взноса', 'взносов'])}` : '';
}

/** "через 10 месяцев" from the current month to the due one, with both. */
export function monthsTo(months: number): string {
  return months > 0 ? `через ${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}` : '';
}
