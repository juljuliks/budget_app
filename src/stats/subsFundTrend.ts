// «Динамика» of a category with «Подписки» (each merchant a subscription: what it costs a month and a year, whether it
// went up, whether it still charges) and of one with a fund (put aside against spent by month, the pace to its date).
import type { TrendSpend } from '../db/plans';
import type { Fund, FundMonth } from '../db/plans/funds';
import type { RecurringPayment } from '../db/recurring';
import type { DayKey } from '../shared/lib/dateRange';
import { averageSince, lastChange, paymentsOf, type Change } from './trendKind';
import { monthBars } from './trends';

/** months in a period (schedule.ts: months > 0, weeks < 0, once 0); a week ≈ 12/52 of a month */
const monthsOf = (period: number) => (period > 0 ? period : period < 0 ? (-period * 12) / 52 : null);
/** this many periods without a charge: «больше не списывается» */
const GONE_PERIODS = 2;

export type SubTrend = {
  id: number; name: string; merchantKey: string | null;
  /** one charge (the latest's, as spent; else as set) */
  amount: number;
  /** a month's share and a year's; null — once */
  perMonth: number | null; perYear: number | null;
  /** charged once a year or rarer: "≈ 13 ₾ в месяц" rather than the charge */
  yearly: boolean;
  change: Change | null;
  lastDay: DayKey | null;
  gone: boolean;
};

const daysBetween = (a: DayKey, b: DayKey) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export function subsTrend(payments: RecurringPayment[], spends: TrendSpend[], today: DayKey) {
  const subs: SubTrend[] = payments.map((p) => {
    const charges = paymentsOf(spends.filter((s) => p.merchant_key !== null && s.merchantKey === p.merchant_key));
    const amount = charges[0]?.value ?? p.amount_minor;
    const months = monthsOf(p.period);
    const lastDay = charges[0]?.day ?? null;
    const gone = (p.until !== null && p.until < today)
      || (months !== null && lastDay !== null && daysBetween(lastDay, today) > months * 30.5 * GONE_PERIODS);
    return {
      id: p.id, name: p.name, merchantKey: p.merchant_key, amount,
      perMonth: months === null ? null : amount / months,
      perYear: months === null ? null : (amount / months) * 12,
      yearly: months !== null && months >= 12,
      change: lastChange(charges), lastDay, gone,
    };
  });
  // the ones still charging first, the dearest a month first; the gone ones last
  subs.sort((a, b) => Number(a.gone) - Number(b.gone) || (b.perMonth ?? 0) - (a.perMonth ?? 0));
  const bars = monthBars(spends, today);
  const total = bars.reduce((a, b) => a + b.value, 0);
  return { subs, bars, total, average: averageSince(bars) };
}

export type SubsTrend = ReturnType<typeof subsTrend>;

const ymAdd = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthsFromTo = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
/** the months of contributions the pace averages (the full ones before this) */
const PACE_MONTHS = 6;
const TOP_MERCHANTS = 3;

/** `months`: the fund's ledger (fundLedger), its currency; `spends`: its category's (converted, for the merchants). */
export function fundTrend(fund: Fund, months: FundMonth[], balance: number, spends: TrendSpend[], today: DayKey) {
  const ym = today.slice(0, 7);
  const by = new Map(months.map((m) => [m.ym, m]));
  const bars = Array.from({ length: 12 }, (_, i) => {
    const key = ymAdd(ym, i - 11);
    const m = by.get(key);
    return { ym: key, saved: m?.contribution ?? 0, spent: m?.spent ?? 0, planned: !!m, current: key === ym };
  });
  const past = months.filter((m) => m.ym < ym).slice(-PACE_MONTHS);
  const pace = past.length ? past.reduce((a, m) => a + m.contribution, 0) / past.length : null;
  const left = Math.max(0, fund.target_minor - balance);
  const dueYm = fund.due.slice(0, 7);
  const doneYm = left === 0 ? ym : pace ? ymAdd(ym, Math.ceil(left / pace)) : null;
  const short = months.filter((m) => m.shortage > 0);
  const merchants = new Map<string, { key: string | null; name: string; value: number }>();
  for (const p of paymentsOf(spends.filter((s) => s.day >= `${bars[0].ym}-01`))) {
    if (!p.merchant) continue;
    const id = p.merchantKey ?? p.merchant;
    const m = merchants.get(id) ?? { key: p.merchantKey, name: p.merchant, value: 0 };
    m.value += p.value;
    merchants.set(id, m);
  }
  return {
    bars,
    balance, target: fund.target_minor, left, due: fund.due,
    contribution: by.get(ym)?.contribution ?? 0,
    monthsLeft: Math.max(0, monthsFromTo(ym, dueYm)),
    pace,
    /** "к маю 2027, на месяц раньше": when, at the pace, and how far from its date (< 0 — earlier) */
    forecast: doneYm ? { ym: doneYm, offset: monthsFromTo(dueYm, doneYm) } : null,
    savedAll: fund.start_minor + months.reduce((a, m) => a + m.contribution, 0),
    spentAll: months.reduce((a, m) => a + m.spent, 0),
    /** months since it was made with no contribution (a month without a plan) */
    skipped: months.filter((m) => m.ym < ym && m.contribution === 0).map((m) => m.ym),
    shortage: short.length ? { total: short.reduce((a, m) => a + m.shortage, 0), ym: short[short.length - 1].ym } : null,
    merchants: [...merchants.values()].sort((a, b) => b.value - a.value).slice(0, TOP_MERCHANTS),
  };
}

export type FundTrend = ReturnType<typeof fundTrend>;
