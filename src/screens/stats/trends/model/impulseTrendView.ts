// A category's impulsive purchases in its «Динамика»: the last IMPULSE_MONTHS months' answers — the share, by month,
// where, what pushed to them; under MIN_ANSWERS answers just how many are needed.
import type { ImpulseRow } from '@/db/impulseStats';
import type { DayKey, DayRange } from '@/shared/lib/dateRange';
import { MONTHS_NOM } from '@/shared/lib/dates';
import { IMPULSE_MONTHS, impulseByMonth, impulseMerchants, impulseSummary, MIN_ANSWERS } from '@/stats/impulse';

const p2 = (n: number) => String(n).padStart(2, '0');

/** The months counted: from the 1st of IMPULSE_MONTHS − 1 months back to today. */
export function impulseWindow(today: DayKey): DayRange {
  const [y, m] = today.split('-').map(Number);
  const start = new Date(y, m - IMPULSE_MONTHS, 1);
  return { from: `${start.getFullYear()}-${p2(start.getMonth() + 1)}-01`, to: today };
}

export type ImpulseTrendView = ReturnType<typeof impulseTrendView>;

/** null — nothing to show: "Импульсивные покупки" off and nothing answered in the window. */
export function impulseTrendView(rows: ImpulseRow[], on: boolean, today: DayKey) {
  const summary = impulseSummary(rows);
  if (!on && summary.answered === 0) return null;
  const window = impulseWindow(today);
  const shares = new Map(impulseByMonth(rows).map((x) => [x.ym, x.share]));
  const [y, m] = today.split('-').map(Number);
  const months = Array.from({ length: IMPULSE_MONTHS }, (_, i) => {
    const d = new Date(y, m - IMPULSE_MONTHS + i, 1);
    const ym = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    return { ym, label: MONTHS_NOM[d.getMonth()].slice(0, 3), share: shares.get(ym) ?? null, current: i === IMPULSE_MONTHS - 1 };
  });
  return {
    window,
    summary,
    /** enough answers for the rest; else "Для анализа нужно 10 ответов, сейчас N" */
    enough: summary.answered >= MIN_ANSWERS,
    /** "Доля импульсивных по месяцам": when at least two months have answers */
    months: shares.size >= 2 ? months : null,
    merchants: impulseMerchants(rows),
    /** purchases asked about with no answer: "Отметить N покупок ›" */
    unanswered: summary.asked - summary.answered,
  };
}
