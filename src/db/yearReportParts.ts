// «Итоги года» in parts: what came in, the plans' limits, the months, the savings, the funds, a month's main reason.
import { getDb } from './index';
import { Currency, dateKey } from './fx';
import { allFunds, fundForecasts, type FundForecast, fundLedger, planRateDate, ymOf } from './plans';
import { savingsPlanFact } from './reportSavings';
import { MonthLimit, YearRow } from '../stats/yearFacts';

import type { Converter } from './fx';
import type { HistoryMonth } from './plans';
import { yearCurrency, type YearMonth, type YearReport } from './yearReport';

/** What came in each month: «Пополнение счёта», and each transfer category that brought in more than was sent. */
export async function yearIncome(
  rows: YearRow[],
  from: number,
  to: number,
  currency: Currency,
  conv: Converter,
  transferIds: Set<number>,
): Promise<Map<string, number>> {
  const db = await getDb();
  const ymOfTs = (ts: number) => dateKey(ts).slice(0, 7);
  const income = new Map<string, number>();
  const deposits = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    `SELECT amount_minor, currency, occurred_at FROM transactions WHERE kind = 'deposit' AND occurred_at >= ? AND occurred_at < ?
      AND category_id = (SELECT id FROM categories WHERE system = 'topup')`,
    [from, to],
  );
  for (const d of deposits)
    income.set(
      ymOfTs(d.occurred_at),
      (income.get(ymOfTs(d.occurred_at)) ?? 0) +
        (conv(d.amount_minor, d.currency, currency, dateKey(d.occurred_at)) ?? 0),
    );
  const net = new Map<string, number>();
  for (const r of rows.filter((x) => x.category_id !== null && transferIds.has(x.category_id))) {
    const k = `${ymOfTs(r.occurred_at)}|${r.category_id}`;
    net.set(k, (net.get(k) ?? 0) + r.value);
  }
  for (const [k, v] of net) if (v < 0) income.set(k.slice(0, 7), (income.get(k.slice(0, 7)) ?? 0) - v);

  return income;
}

/** The plans' limits of the year, in `currency`: «перерасход в N из M месяцев» and a month's main reason. */
export async function yearLimits(year: number, currency: Currency, conv: Converter): Promise<MonthLimit[]> {
  const db = await getDb();
  return (
    await db.all<{ ym: string; category_id: number; limit_minor: number; currency: string }>(
      "SELECT ym, category_id, limit_minor, currency FROM plan_items WHERE ym >= ? AND ym <= ? AND kind != 'fund'",
      [`${year}-01`, `${year}-12`],
    )
  ).map((i) => ({
    ym: i.ym,
    category_id: i.category_id,
    limit: conv(i.limit_minor, i.currency, currency, planRateDate(i.ym)) ?? 0,
  }));
}

/** The twelve months: not begun, before any data, or what came in, was spent and put aside (of the history). */
export function yearMonths(
  year: number,
  nowYm: string,
  history: Map<string, HistoryMonth>,
  income: Map<string, number>,
): YearMonth[] {
  const months: YearMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const ym = ymOf(year, m);
    const h = history.get(ym);
    if (ym > nowYm || !h) {
      months.push({
        ym,
        state: ym > nowYm ? 'future' : 'none',
        income: 0,
        spent: 0,
        hasPlan: false,
        budget: null,
        saved: null,
        pct: null,
      });
      continue;
    }
    const saved = h.budget_minor === null ? null : h.budget_minor - h.spent_minor;
    months.push({
      ym,
      state: 'data',
      income: income.get(ym) ?? 0,
      spent: h.spent_minor,
      hasPlan: h.budget_minor !== null || h.planned_minor > 0,
      budget: h.budget_minor,
      saved,
      pct: saved === null || !h.budget_minor ? null : Math.round((saved / h.budget_minor) * 100),
    });
  }
  return months;
}

/** The month's main reason to put aside little: its biggest overspend of a plan, or its biggest spending outside it. */
export function reasonOf(
  ym: string,
  rows: YearRow[],
  limits: MonthLimit[],
  skip: Set<number>,
  transfers: Set<number>,
  label: (id: number | null) => string,
): string | null {
  const by = new Map<number, number>();
  for (const r of rows) {
    if (
      r.category_id === null ||
      skip.has(r.category_id) ||
      transfers.has(r.category_id) ||
      dateKey(r.occurred_at).slice(0, 7) !== ym
    )
      continue;
    by.set(r.category_id, (by.get(r.category_id) ?? 0) + r.value);
  }
  let best: { id: number; v: number; planned: boolean } | null = null;
  for (const [id, spent] of by) {
    const limit = limits.find((l) => l.ym === ym && l.category_id === id);
    const v = limit ? spent - limit.limit : spent;
    if (v > 0 && (!best || v > best.v)) best = { id, v, planned: !!limit };
  }
  return best ? `${label(best.id)} ${best.planned ? 'сверх плана' : 'вне плана'}` : null;
}

/** The closed months' «План / Факт», added up. null — none closed. */
export async function yearSavings(yms: string[], currency: Currency, nowYm: string): Promise<YearReport['savings']> {
  const z = () => ({ plan: 0, fact: 0 });
  const s = { locked: z(), rest: z(), funds: z(), total: z(), months: 0 };
  for (const ym of yms) {
    const pf = await savingsPlanFact(ym, currency, nowYm);
    if (!pf?.closed) continue;
    s.months += 1;
    if (pf.locked) {
      s.locked.plan += pf.locked.plan;
      s.locked.fact += pf.locked.fact ?? 0;
    }
    if (pf.rest && (pf.rest.choice === null || pf.rest.choice === 'savings')) {
      s.rest.plan += pf.rest.plan;
      s.rest.fact += pf.rest.fact ?? 0;
    }
    for (const f of pf.funds) {
      s.funds.plan += f.plan;
      s.funds.fact += f.fact ?? 0;
    }
    s.total.plan += pf.plan;
    s.total.fact += pf.fact ?? 0;
  }
  return s.months ? s : null;
}

/** The funds of the year (not deleted ones): what each has of its sum, and (this year) whether it makes it by its date. */
export async function fundsOfYear(
  funds: Awaited<ReturnType<typeof allFunds>>,
  year: number,
  nowYm: string,
  label: (id: number) => string,
): Promise<YearReport['fundsNow']> {
  const forecasts = nowYm.startsWith(String(year)) ? await fundForecasts(nowYm) : new Map<number, FundForecast>();
  const out: YearReport['fundsNow'] = [];
  for (const f of funds) {
    if (f.closed_ym || f.since_ym > `${year}-12`) continue; // a deleted fund: its money went to that month's savings
    const { balance } = await fundLedger(f, nowYm < `${year}-12` ? nowYm : `${year}-12`, nowYm);
    const fc = forecasts.get(f.category_id);
    out.push({
      id: f.category_id,
      label: label(f.category_id),
      saved: balance,
      target: f.target_minor,
      currency: f.currency,
      due: f.due,
      ok: fc ? fc.status === 'ok' : null,
    });
  }
  return out;
}

/** The currency «Отложено» is said in (the last budget's) and the rate to it on that month's plan date; null — the same. */
export async function savedInOf(
  year: number,
  currency: Currency,
  nowYm: string,
  conv: (v: number, from: string, to: string, date: string) => number | null,
) {
  const target = await yearCurrency(year, currency, nowYm);
  if (target === currency) return null;
  const last = nowYm < `${year}-12` ? nowYm : `${year}-12`;
  const rate = conv(1000000, currency, target, planRateDate(last));
  return rate === null ? null : { currency: target, rate: rate / 1000000 };
}
