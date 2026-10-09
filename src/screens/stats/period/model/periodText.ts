// The period stats' words and formulas: section names, "(500 ₾ − 120 ₾) / 28 × 7 = 95 ₾", what's left or overspent.
import { NormPeriod, parseYm } from '@/db/plans';
import type { SummaryGroupKey } from '@/entities/plan';
import { DayRange, daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { MONTHS_PREP, RHYTHM_DAYS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import type { NormPart } from '@/stats/norms';

/**
 * After a "₾" that ends a line: Android takes the sign's width from the main font though it comes from a fallback one,
 * and cut it off ("0 / 106.81" without "₾"); a no-break space after it is what gets cut instead.
 */
export const GLYPH_ROOM = ' ';

/** days in a rhythm window */
export const RHYTHM_LEN = { ...RHYTHM_DAYS, month: 0 } as const;

/** the bottom section of the categories without a plan (as in the plan and the month) */
export const UNPLANNED = 'Вне плана';
/** planned categories whose limit these days can't measure: just their spending */
export const OTHER = 'Другие траты';
/** day / week categories over their month's plan: no limit left, a section of their own */
export const OVERSPENT = 'Перерасход плана месяца';

/** what a limits block counts, in plain words */
export const GROUP_ABOUT: Record<SummaryGroupKey, string> = {
  day: 'Категории с лимитом на день: лимит на выбранные дни.',
  week: 'Категории с лимитом на неделю. Если период короче недели, считается вся неделя, как в строках категорий: траты в другие её дни тоже входят.',
  '2weeks': 'Категории с лимитом на 2 недели. Если период короче, считаются обе недели целиком: траты в другие их дни тоже входят.',
  month: 'Категории, которые вы тратите «крупно, раз в месяц»: план на месяц и траты с 1-го.',
  fixed: 'Аренда, подписки, кредит: оплачено с 1-го числа против плана месяца. Осталось — сколько ещё предстоит оплатить, это не свободные деньги. Переплата — перерасход.',
  outside: 'Категории без плана в этом месяце и траты без категории. Доля на них задаётся в бюджете месяца — она как месячный лимит: траты с 1-го против неё.',
};

export const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

type Money = (minor: number) => string;

/** "перерасход 69 ₾" / "осталось 20 ₾" */
export function deltaText(spent: number, norm: number, money: Money): string {
  const d = Math.round(norm) - spent;
  return d < 0 ? `перерасход ${money(-d)}` : `осталось ${money(d)}`;
}

/** "(500 ₾ − 120 ₾) / 28 × 7 = 95 ₾": what's left of the month's plan over the days left, per month part */
export function formulaText(parts: NormPart[], m: Money): string {
  const total = parts.reduce((a, p) => a + p.norm, 0);
  const terms = parts.map((p) => (p.spentBefore > 0
    ? `(${m(p.limit)} − ${m(p.spentBefore)}) / ${p.daysLeft} × ${p.days}`
    : `${m(p.limit)} / ${p.daysLeft} × ${p.days}`)).join(' + ');
  return parts.length > 1 ? `${terms} = ${parts.map((p) => m(p.norm)).join(' + ')} = ${m(total)}` : `${terms} = ${m(total)}`;
}

/** "в сентябре плана нет — его дни считаются как 0" for the parts without a plan */
export function noPlanText(parts: NormPart[]): string {
  const missing = parts.filter((p) => p.limit === 0).map((p) => MONTHS_PREP[parseYm(p.ym).month]);
  return missing.length ? ` В ${missing.join(' и ')} у категории плана нет — эти дни считаются как 0.` : '';
}

/**
 * "Неделя 5 – 11 окт: " before what a weekly limit has left: its days in this month only (a week across months is cut
 * at the month's edge, as its limit is); nothing when those days are just the viewed period.
 */
export function windowLabelText(ym: string, range: DayRange, rhythm: NormPeriod, w: DayRange): string {
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const part = { from: w.from < first ? first : w.from, to: w.to > last ? last : w.to };
  if (part.from === range.from && part.to === range.to) return '';
  return `${rhythm === 'week' ? 'Неделя' : '2 недели'} ${shortRange(part)}: `;
}

/** The line under the donut: no plan for these days, or a long period's average per month. */
export function summaryText(pace: boolean, limits: number, average: { average_minor: number; months: number } | null | undefined, money: Money): string | null {
  if (pace) return limits ? null : 'Плана на эти дни нет — показана только структура трат.';
  if (average === undefined) return '';
  if (average === null) return 'Для среднего в месяц нужен хотя бы один полный месяц с данными.';
  return `В среднем ${money(average.average_minor)} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;
}
