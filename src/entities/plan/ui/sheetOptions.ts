// The plan sheet's choices and texts: the kinds, the spending patterns, the toast after saving.
import type { Currency } from '@/db/fx';
import type { PlanKind } from '@/db/plans';
import { RHYTHM_DAYS } from '@/shared/lib/dates';
import { daysInMonth } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD, SPENDING_PATTERN } from '@/shared/lib/strings';

export const KINDS = [
  ['limit', 'Траты с лимитом', 'Еда, кафе, одежда — сумма меняется, следим, сколько осталось'],
  ['subs', 'Регулярный платёж', 'Обеды, аренда, страховка — каждый день, неделю, месяц или реже'],
  ['fixed', 'Разовый платёж', 'Подарок, ремонт, взнос — известная сумма в этом месяце'],
  ['fund', 'Копилка', 'Отпуск, страховка, техника — копить понемногу, потратить разом'],
] as const;

export const BY_HAND_HINT = 'Сумма считается из списаний подписок категории; пока ни у одной нет даты — она вводится здесь.';

export const COUNTED_HINT = 'Сумма считается из списаний подписок категории. Другой вид — сумма вводится вручную, подписки останутся.';

/** A regular payment rarer than monthly: its charge's day is needed (the charges are counted from it). */
export const dateNeeded = () => 'Выберите дату списания';

export const UNTIL_BEFORE = 'Дата окончания раньше даты списания';

export const PICK_HINT = 'Подписка делается из операции: выберите её среди операций категории за месяц — сумма, мерчант и дата следующего списания возьмутся из неё.';

// how the category is spent: its limit in day / week stats is counted per this period
const PATTERN_KEYS = ['day', 'week', '2weeks', 'month'] as const;

/** The patterns, each with what the entered amount makes per its period: "Каждый день · ≈ 15 ₾ в день". */
export function patterns(minor: number | null, currency: Currency, ym: string) {
  return PATTERN_KEYS.map((p) => {
    const per = !minor ? null : p === 'month' ? minor : Math.round((minor / daysInMonth(ym)) * RHYTHM_DAYS[p]);
    const title = per === null ? SPENDING_PATTERN[p].title : `${SPENDING_PATTERN[p].title} · ${p === 'month' ? '' : '≈ '}${formatWithCurrency(per, currency)} ${PER_PERIOD[p]}`;
    return [p, title, SPENDING_PATTERN[p].hint] as const;
  });
}

/** The toast after saving: the item or the fund, added or changed; the repeating payments turned off, 🔒 taken. */
export function savedText(k: PlanKind, label: string, adding: boolean, off: boolean, taken?: string): string {
  const plain = k === 'fund' ? `Копилка «${label}» сохранена` : adding ? `«${label}» ${taken ? 'в плане' : 'добавлена в план'}` : `План «${label}» сохранён`;
  const done = off ? `${plain}, регулярные платежи выключены` : plain;
  return taken ? `${done}, из 🔒 вычтено ${taken}` : done;
}
