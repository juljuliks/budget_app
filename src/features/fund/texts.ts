// A fund on its category's page: the switch, the fields, what it puts in this month.
import { MONTHS_GEN, MONTHS_PREP } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import type { FundThisMonth } from '@/db/plans';

export const FUND_SWITCH = 'Копилка';
export const FUND_HINT_OFF = 'Копить на нечастую трату — отпуск, страховку, технику: сумма к дате, взнос каждый месяц в плане.';
export const FUND_HINT_ON = 'Траты категории берутся из копилки и не тратят бюджет месяца.';
export const SAVE_FUND = 'Сохранить копилку';
export const FUND_CARD = 'Копилка: взносы и траты';

const monthPrep = (ym: string) => MONTHS_PREP[Number(ym.slice(5)) - 1];
const fromMonth = (ym: string) => `с ${MONTHS_GEN[Number(ym.slice(5)) - 1]}`;
export const months = (n: number) => `${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;

/**
 * Under the fields, for the saved fund: "В ноябре — 80 $: 30 $ из плана, 50 $ из «Отложить сразу». С декабря — 128 $ в
 * месяц."; all of it — null (the plate's "N в месяц" says it); nothing fitted — "В ноябре — 0 ₾: бюджет месяца расписан…".
 */
export function thisMonthText(m: FundThisMonth, ym: string): { text: string; zero: boolean } | null {
  const short = m.put < m.asked;
  if (!short && m.taken === 0) return null;
  const cur = m.fund.currency;
  const next = short ? ` ${fromMonth(m.next.ym).replace(/^с/, 'С')} — ${formatWithCurrency(m.next.asked, cur)} в месяц.` : '';
  if (m.put === 0) {
    return { text: `Бюджет ${MONTHS_GEN[Number(ym.slice(5)) - 1]} расписан, в «Отложить сразу» пусто.${next}`, zero: true };
  }
  const taken = m.taken > 0 ? formatWithCurrency(m.taken, m.takenCurrency ?? cur) : null;
  // "из плана" only when the plan gave some ("MAX" 🔒: all of it is 🔒's)
  const fromPlan = m.takenCurrency === cur ? m.put - m.taken : null;
  const plan = fromPlan !== null && fromPlan > 0 ? `${formatWithCurrency(fromPlan, cur)} из плана, ` : '';
  const parts = taken ? `: ${plan}${taken} из «Отложить сразу»` : '';
  return { text: `В ${monthPrep(ym)} — ${formatWithCurrency(m.put, cur)}${parts}.${next}`, zero: false };
}

/** The plate's title when nothing fitted: "В ноябре — 0 ₾". */
export const zeroTitle = (m: FundThisMonth, ym: string) => `В ${monthPrep(ym)} — ${formatWithCurrency(0, m.fund.currency)}`;
