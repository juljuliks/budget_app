// «В плане» on a category's page: the kinds, what each means for the next month, the summary of a set one.
import type { CategoryPlanKind } from '@/db/plans';
import type { RecurringPayment } from '@/db/recurring';
import { dayTitle, longDay } from '@/shared/lib/dates';
import { everyText } from '@/entities/plan';
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
  regular: 'Как часто — здесь; сумма — в плане месяца, дальше переходит в следующие (реже раза в месяц — здесь).',
  oneoff: 'В следующий месяц не переходит.',
  fund: 'Траты категории берутся из копилки и не тратят бюджет месяца.',
};

/** "1 200 ₾ · раз в год" — the category's own payment rarer than monthly; a monthly one's amount is the plan's: "каждый месяц". */
export const paymentSummary = (p: Pick<RecurringPayment, 'amount_minor' | 'currency' | 'period' | 'until'>) =>
  (p.period === 1 ? withEnd('каждый месяц', p.until) : `${formatWithCurrency(p.amount_minor, p.currency)} · ${periodText(p.period)}`);

/** "пн, чт", "каждый день · до 15 окт" — a payment within the month: how often (its amount is the plan's). */
export const withinMonthSummary = (every: 'day' | 'week', weekdays: number, until: string | null) => withEnd(everyText(every, weekdays), until);

const withEnd = (text: string, until: string | null) => (until ? `${text} · до ${longDay(until)}` : text);

/** "1 500 $ к 31 июля 2027" — a fund. */
export const fundSummary = (target: number, currency: string, due: string) => `${formatWithCurrency(target, currency)} к ${dayTitle(due)}`;

export const kindSaved = (label: string) => `«${label}»: вид в плане сохранён`;
