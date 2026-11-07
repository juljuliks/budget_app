// «В плане» on a category's page: the kinds, what each means for the next month, the summary of a set one.
import type { CategoryPlanKind } from '@/db/plans';
import type { RecurringPayment } from '@/db/recurring';
import { dayTitle, WEEKDAYS } from '@/shared/lib/dates';
import { periodText } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';

export const KIND_TITLE = 'В плане';
export const SETUP = 'Настроить';
export const CHANGE = 'Изменить';

export const KIND_OPTIONS: ReadonlyArray<readonly [CategoryPlanKind, string, string]> = [
  ['limit', 'Траты с лимитом', 'Еда, кафе, одежда — сумма меняется, следим, сколько осталось'],
  ['regular', 'Регулярный платёж', 'Обеды, аренда, страховка — каждый день, неделю, месяц или реже'],
  ['oneoff', 'Разовый платёж', 'Подарок, ремонт, врач — добавляете в план месяца, когда нужно'],
  ['fund', 'Копилка', 'Копить на нечастую трату — отпуск, технику: сумма к дате, взнос каждый месяц'],
];

/** Under the kinds: what a new month gets of it. */
export const KIND_HINTS: Record<CategoryPlanKind, string> = {
  limit: 'Сумма и «Как тратите» — в плане месяца; дальше переходят в следующие.',
  regular: 'Сумма стоит в плане каждого месяца по расписанию.',
  oneoff: 'В следующий месяц не переходит.',
  fund: 'Траты категории берутся из копилки и не тратят бюджет месяца.',
};

/** "650 $ · каждый месяц" — the category's own payment. */
export const paymentSummary = (p: Pick<RecurringPayment, 'amount_minor' | 'currency' | 'period'>) =>
  `${formatWithCurrency(p.amount_minor, p.currency)} · ${periodText(p.period)}`;

/** "пн, чт · 20 ₾ за раз", "каждый день · 5 ₾ за раз" — a payment within the month. */
export function withinMonthSummary(every: 'day' | 'week', weekdays: number, unit: number, currency: string): string {
  const days = every === 'day' ? 'каждый день'
    : [0, 1, 2, 3, 4, 5, 6].filter((i) => (weekdays & (1 << i)) !== 0).map((i) => WEEKDAYS[(i + 1) % 7]).join(', ');
  return `${days} · ${formatWithCurrency(unit, currency)} за раз`;
}

/** "1 500 $ к 31 июля 2027" — a fund. */
export const fundSummary = (target: number, currency: string, due: string) => `${formatWithCurrency(target, currency)} к ${dayTitle(due)}`;

export const kindSaved = (label: string) => `«${label}»: вид в плане сохранён`;
