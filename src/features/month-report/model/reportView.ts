// What the month's report says, worked out from it: what to improve and what is good, their sums a year, the ⓘ texts.
import type { Currency } from '@/db/fx';
import { parseYm } from '@/db/plans';
import { AVERAGE_MONTHS, MonthReport, yearly } from '@/db/report';
import { monthTitle } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';

export const reportTitle = (ym: string) => { const { year, month } = parseYm(ym); return monthTitle(year, month); };

type Part = [string, number];

export function reportView(r: MonthReport, currency: Currency) {
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency ?? currency);
  // a year is an estimate: whole units
  const perYear = (v: number) => formatWithCurrency(Math.round(yearly(v) / 100) * 100, r.currency ?? currency);
  const diff = r.saved !== null && r.previousSaved !== null ? Math.round(r.saved - r.previousSaved) : 0;
  const better = Math.max(0, diff);
  const worse = Math.max(0, -diff);
  // each block's amounts this month; the header shows them together × 12, its ⓘ lists them
  const badParts = ([
    // "взято из отложенного" is a consequence of these, not added to them
    ['перерасход лимитов', r.overLimitsTotal], ['вне плана сверх доли', r.unplannedOver], ['меньше, чем месяцем раньше', worse],
  ] as Part[]).filter(([, v]) => v > 0);
  const goodParts = ([
    ['сэкономлено в плане', r.savedInPlan], ['переведено в «Сбережения» вручную', r.movedToSavings], ['больше, чем месяцем раньше', better],
  ] as Part[]).filter(([, v]) => v > 0);
  const badMonth = badParts.reduce((a, [, v]) => a + v, 0);
  const goodMonth = goodParts.reduce((a, [, v]) => a + v, 0);
  /** "Перерасход лимитов 150 ₾ + вне плана сверх доли 400 ₾ = 550 ₾ за месяц; × 12 = 6 600 ₾." */
  const yearInfo = (parts: Part[], sign: string, tail: string) => {
    const total = parts.reduce((a, [, v]) => a + v, 0);
    const list = parts.map(([l, v]) => `${l} ${money(v)}`).join(' + ');
    return `${list.charAt(0).toUpperCase()}${list.slice(1)}${parts.length > 1 ? ` = ${money(total)}` : ''} за месяц; × 12 = ${sign}${perYear(total)}. ${tail}`;
  };
  const improve = badMonth > 0 || r.lockedTouched > 0 || r.review || r.uncategorizedCount > 0 || r.unpaid.length > 0 || worse > 0;
  const good = goodMonth > 0 || (r.locked > 0 && r.lockedTouched === 0) || (r.saved !== null && r.overLimits.length === 0) || (r.unplannedSpent > 0 && r.unplannedOver === 0 && !r.review);
  // what "вне плана" means here
  const unplannedInfo = `Вне плана — траты в категориях без суммы в плане и без категории (переводы тоже): ${money(r.unplannedSpent)}. `
    + (r.unplannedShare > 0 ? `На них выделена доля бюджета ${money(r.unplannedShare)}; ` : 'Доли бюджета на них не выделено; ')
    + (r.unplannedSpent > r.unplannedShare ? `сверх неё — ${money(r.unplannedSpent - r.unplannedShare)}: эти деньги не отложились.` : `из неё осталось ${money(r.unplannedShare - r.unplannedSpent)}.`);
  /** The ⓘ of the year's estimate: the average of the latest months with data × 12. */
  const averageInfo = () => {
    const a = r.average!;
    const names = a.months.map((m) => `${reportTitle(m.ym).split(' ')[0].toLowerCase()} ${money(m.saved)}`).join(', ');
    const avg = a.months.length > 1 ? `(${a.months.map((m) => money(m.saved)).join(' + ')}) / ${a.months.length} = ${money(a.saved)}` : money(a.saved);
    return `Отложено в среднем за месяц: ${avg}; × 12 = ${perYear(a.saved)}.\n\nМесяцы: ${names}. Берутся до ${AVERAGE_MONTHS} последних `
      + 'месяцев с бюджетом и полными данными (операции с первой половины месяца): один удачный или неудачный месяц меньше качает оценку.';
  };
  return {
    r, money, perYear, better, worse, badParts, goodParts, badMonth, goodMonth, yearInfo, improve, good, unplannedInfo, averageInfo,
    plus: (v: number) => `+${money(v)}`,
    minus: (v: number) => `−${money(v)}`,
  };
}

export type ReportView = ReturnType<typeof reportView>;
