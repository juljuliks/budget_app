// The plan sheet's choices and texts: the kinds, the spending patterns, the toast after saving.
import type { Currency } from '@/db/fx';
import type { CategoryPlanKind, PlanKind } from '@/db/plans';
import { RHYTHM_DAYS, WEEKDAYS } from '@/shared/lib/dates';
import { daysInMonth } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD, SPENDING_PATTERN } from '@/shared/lib/strings';

/** What a plan item is, by its category's kind (set on the category's page, «В плане»). */
export const KIND_NAMES: Record<PlanKind, string> = {
  limit: 'Траты с лимитом', subs: 'Регулярный платёж', fixed: 'Разовый платёж', fund: 'Копилка',
};

/** A category added to the plan: its item as its kind says; none set — a one-off payment. */
export const itemKindOf = (k: CategoryPlanKind | null): PlanKind => (k === 'limit' ? 'limit' : k === 'regular' ? 'subs' : 'fixed');

/** A regular payment in the plan: its amount is its category's. */
/** A regular payment rarer than monthly in the plan: its amount is its category's (asked ahead, it may be saved up for). */
export const REGULAR_HINT = 'Сумма и дата списания — на странице категории, меняются во всех месяцах с этого.';

/** A regular payment every day, week or month in the plan: the amount here, how often — its category's. */
export const SCHEDULE_HINT = 'Как часто и дата окончания — на странице категории. Сумма переходит в следующие месяцы.';

/** "каждый день", "пн, чт", "каждый месяц" — how often a regular payment is, without its amount. */
export function everyText(every: 'day' | 'week' | 'month', weekdays: number): string {
  if (every === 'day') return 'каждый день';
  if (every === 'month') return 'каждый месяц';
  return [0, 1, 2, 3, 4, 5, 6].filter((i) => (weekdays & (1 << i)) !== 0).map((i) => WEEKDAYS[(i + 1) % 7]).join(', ');
}

export const BY_HAND_HINT = 'Сумма считается из списаний подписок категории; пока ни у одной нет даты — она вводится здесь.';

export const COUNTED_HINT = 'Сумма считается из списаний подписок категории. Другой вид — сумма вводится вручную, подписки останутся.';

/** A regular payment rarer than monthly: its charge's day is needed (the charges are counted from it). */
export const dateNeeded = () => 'Выберите дату списания';

export const UNTIL_BEFORE = 'Дата окончания раньше даты списания';

export const PICK_HINT = 'Подписки делаются из мерчантов категории: на её странице — «Сделать подпиской». Сумма в плане будет считаться из их списаний.';

/** A category with "Подписки" off in the plan, its subscriptions there: they count again. */
export const RESUME_HINT = 'Сумма будет считаться из списаний подписок категории.';

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
  const plain = adding ? `«${label}» ${taken ? 'в плане' : 'добавлена в план'}` : `План «${label}» сохранён`;
  const done = off ? `${plain}, регулярные платежи выключены` : plain;
  return taken ? `${done}, из 🔒 вычтено ${taken}` : done;
}
