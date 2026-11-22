// «Итоги года»: a year month by month (what came in, was spent, put aside, its share of the budget) and in all (the
// savings planned and put aside, the funds, where the money went, what is remembered, the impulsive purchases). The
// spending is read once for the year (not monthStats in a loop): tests/logic/statsQueries.test.ts.
import { getDb } from './index';
import { Currency, dateKey } from './fx';
import { categoryLabel } from './categories';
import { allFunds, currentYm, fundForecasts, fundLedger, lockedPctSetting, planHistory, planRateDate, ymOf } from './plans';
import { convertSpending, spendRows } from './plans/spend';
import { savingsPlanFact } from './reportSavings';
import { impulseRows } from './impulseStats';
import { impulseSummary, ImpulseSummary } from '../stats/impulse';
import { biggestPurchase, frequentMerchant, Frequent, MonthLimit, noSpendDays, NoSpendDays, subscriptions, Subscriptions, TopCategory, topCategories, YearRow } from '../stats/yearFacts';

/** 'future' — not begun; 'none' — before the first operation or plan; 'data' — a month to show. */
export type YearMonth = {
  ym: string; state: 'future' | 'none' | 'data'; income: number; spent: number;
  /** with a plan (a budget or an amount): its report opens; without — only what came in and was spent */
  hasPlan: boolean; budget: number | null; saved: number | null;
  /** put aside of the budget, % (null — no budget) */
  pct: number | null;
};
export type YearPlanFact = { plan: number; fact: number };
export type YearReport = {
  year: number; currency: Currency; months: YearMonth[];
  /** the months with data so far; `over` — the year is over */
  count: number; over: boolean;
  income: number; spent: number; saved: number; budget: number; funds: number; planMonths: number;
  /** what the year would put aside at this pace (null — over, or nothing to go on) */
  pace: number | null;
  goalPct: number | null;
  best: { ym: string; saved: number; pct: number | null } | null;
  worst: { ym: string; saved: number; reason: string | null } | null;
  /** the closed months' savings: planned and put aside */
  savings: { locked: YearPlanFact; rest: YearPlanFact; funds: YearPlanFact; total: YearPlanFact; months: number } | null;
  fundsNow: Array<{ id: number; label: string; saved: number; target: number; currency: string; due: string; ok: boolean | null; closed: boolean }>;
  top: Array<TopCategory & { label: string }>;
  biggest: { label: string; merchant: string; day: string; value: number } | null;
  subs: Subscriptions | null;
  frequent: Frequent | null;
  noSpend: NoSpendDays | null;
  impulse: ImpulseSummary | null;
};

const unix = (y: number, m: number) => new Date(y, m, 1).getTime() / 1000;

export async function yearReport(year: number, currency: Currency, nowYm = currentYm()): Promise<YearReport> {
  const db = await getDb();
  const [from, to] = [unix(year, 0), unix(year + 1, 0)];
  const history = new Map((await planHistory(nowYm, currency)).map((m) => [m.ym, m]));
  const cats = await db.all<{ id: number; name: string; emoji: string | null; type_name: string | null; transfer: number; system: string | null; plan_kind: string | null; recurring: number }>(
    `SELECT c.id, c.name, c.emoji, ct.name AS type_name, coalesce(ct.is_transfer, 0) AS transfer, c.system, c.plan_kind, c.recurring
      FROM categories c LEFT JOIN category_types ct ON ct.id = c.type_id`);
  const label = (id: number | null) => { const c = cats.find((x) => x.id === id); return c ? categoryLabel(c) : 'Без категории'; };
  const funds = await allFunds();
  const fundIds = new Set(funds.map((f) => f.category_id));
  const transferIds = new Set(cats.filter((c) => c.transfer).map((c) => c.id));

  // the year's spending, once
  const { items, conv } = await convertSpending(await spendRows(from, to), currency);
  const rows: YearRow[] = items.map(({ row: r, value }) => ({
    value, own: r.amount_minor, currency: r.currency, category_id: r.category_id, kind: r.kind, occurred_at: r.occurred_at,
    merchant_key: r.merchant_key ?? null, raw_merchant: r.raw_merchant ?? null,
  }));
  const ymOfTs = (ts: number) => dateKey(ts).slice(0, 7);
  // what came in: «Пополнение счёта» and each transfer category that brought in more than was sent (as monthIncome)
  const income = new Map<string, number>();
  const deposits = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    `SELECT amount_minor, currency, occurred_at FROM transactions WHERE kind = 'deposit' AND occurred_at >= ? AND occurred_at < ?
      AND category_id = (SELECT id FROM categories WHERE system = 'topup')`, [from, to]);
  for (const d of deposits) income.set(ymOfTs(d.occurred_at), (income.get(ymOfTs(d.occurred_at)) ?? 0) + (conv(d.amount_minor, d.currency, currency, dateKey(d.occurred_at)) ?? 0));
  const net = new Map<string, number>();
  for (const r of rows.filter((x) => x.category_id !== null && transferIds.has(x.category_id))) {
    const k = `${ymOfTs(r.occurred_at)}|${r.category_id}`;
    net.set(k, (net.get(k) ?? 0) + r.value);
  }
  for (const [k, v] of net) if (v < 0) income.set(k.slice(0, 7), (income.get(k.slice(0, 7)) ?? 0) - v);

  // the plans' limits, for «перерасход в N из M месяцев» and a month's main reason
  const limits: MonthLimit[] = (await db.all<{ ym: string; category_id: number; limit_minor: number; currency: string }>(
    "SELECT ym, category_id, limit_minor, currency FROM plan_items WHERE ym >= ? AND ym <= ? AND kind != 'fund'", [`${year}-01`, `${year}-12`]))
    .map((i) => ({ ym: i.ym, category_id: i.category_id, limit: conv(i.limit_minor, i.currency, currency, planRateDate(i.ym)) ?? 0 }));

  const months: YearMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const ym = ymOf(year, m);
    const h = history.get(ym);
    if (ym > nowYm || !h) { months.push({ ym, state: ym > nowYm ? 'future' : 'none', income: 0, spent: 0, hasPlan: false, budget: null, saved: null, pct: null }); continue; }
    const saved = h.budget_minor === null ? null : h.budget_minor - h.spent_minor;
    months.push({
      ym, state: 'data', income: income.get(ym) ?? 0, spent: h.spent_minor, hasPlan: h.budget_minor !== null || h.planned_minor > 0,
      budget: h.budget_minor, saved, pct: saved === null || !h.budget_minor ? null : Math.round((saved / h.budget_minor) * 100),
    });
  }
  const data = months.filter((m) => m.state === 'data');
  const budgeted = data.filter((m) => m.saved !== null);
  const sum = (list: YearMonth[], f: (m: YearMonth) => number) => list.reduce((a, m) => a + f(m), 0);
  const saved = sum(budgeted, (m) => m.saved!);
  const over = nowYm > `${year}-12`;
  const left = over ? 0 : months.filter((m) => m.state === 'future').length;
  const byBest = [...budgeted].sort((a, b) => b.saved! - a.saved!);
  const worst = budgeted.length > 1 ? byBest[byBest.length - 1] : null;
  return {
    year, currency, months, count: data.length, over,
    income: sum(data, (m) => m.income), spent: sum(data, (m) => m.spent), saved, budget: sum(budgeted, (m) => m.budget!),
    funds: data.reduce((a, m) => a + (history.get(m.ym)?.funds_minor ?? 0), 0), planMonths: data.filter((m) => m.hasPlan).length,
    pace: !over && budgeted.length ? Math.round(saved + (saved / budgeted.length) * left) : null,
    goalPct: await lockedPctSetting(),
    best: byBest.length > 1 ? { ym: byBest[0].ym, saved: byBest[0].saved!, pct: byBest[0].pct } : null,
    worst: worst ? { ym: worst.ym, saved: worst.saved!, reason: reasonOf(worst.ym, rows, limits, fundIds, transferIds, label) } : null,
    savings: await yearSavings(data.filter((m) => m.ym < nowYm).map((m) => m.ym), currency, nowYm),
    fundsNow: await fundsOfYear(funds, year, nowYm, label),
    top: topCategories(rows, limits, data.length, new Set([...fundIds, ...transferIds])).map((c) => ({ ...c, label: label(c.id) })),
    ...rememberedOf(rows, cats, label, data, year, nowYm),
    impulse: ((s) => (s.answered ? s : null))(impulseSummary(await impulseRows(from, to, currency))),
  };
}

/** The month's main reason to put aside little: its biggest overspend of a plan, or its biggest spending outside it. */
function reasonOf(ym: string, rows: YearRow[], limits: MonthLimit[], skip: Set<number>, transfers: Set<number>, label: (id: number | null) => string): string | null {
  const by = new Map<number, number>();
  for (const r of rows) {
    if (r.category_id === null || skip.has(r.category_id) || transfers.has(r.category_id) || dateKey(r.occurred_at).slice(0, 7) !== ym) continue;
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
async function yearSavings(yms: string[], currency: Currency, nowYm: string): Promise<YearReport['savings']> {
  const z = () => ({ plan: 0, fact: 0 });
  const s = { locked: z(), rest: z(), funds: z(), total: z(), months: 0 };
  for (const ym of yms) {
    const pf = await savingsPlanFact(ym, currency, nowYm);
    if (!pf?.closed) continue;
    s.months += 1;
    if (pf.locked) { s.locked.plan += pf.locked.plan; s.locked.fact += pf.locked.fact ?? 0; }
    if (pf.rest && (pf.rest.choice === null || pf.rest.choice === 'savings')) { s.rest.plan += pf.rest.plan; s.rest.fact += pf.rest.fact ?? 0; }
    for (const f of pf.funds) { s.funds.plan += f.plan; s.funds.fact += f.fact ?? 0; }
    s.total.plan += pf.plan; s.total.fact += pf.fact ?? 0;
  }
  return s.months ? s : null;
}

/** The funds of the year: what each has of its sum, and (this year) whether it makes it by its date. */
async function fundsOfYear(funds: Awaited<ReturnType<typeof allFunds>>, year: number, nowYm: string, label: (id: number) => string): Promise<YearReport['fundsNow']> {
  const forecasts = nowYm.startsWith(String(year)) ? await fundForecasts(nowYm) : new Map();
  const out: YearReport['fundsNow'] = [];
  for (const f of funds) {
    if (f.since_ym > `${year}-12` || (f.closed_ym && f.closed_ym < `${year}-01`)) continue;
    const { balance } = await fundLedger(f, nowYm < `${year}-12` ? nowYm : `${year}-12`, nowYm);
    const fc = forecasts.get(f.category_id);
    out.push({ id: f.category_id, label: label(f.category_id), saved: balance, target: f.target_minor, currency: f.currency, due: f.due, ok: fc ? fc.status === 'ok' : null, closed: !!f.closed_ym });
  }
  return out;
}

/** «Запомнилось»: the biggest purchase, the subscriptions, the most frequent merchant, the days without spending. */
function rememberedOf(rows: YearRow[], cats: Array<{ id: number; system: string | null; plan_kind: string | null; recurring: number }>,
  label: (id: number | null) => string, data: YearMonth[], year: number, nowYm: string) {
  const big = biggestPurchase(rows);
  const subsId = cats.find((c) => c.system === 'subs')?.id ?? null;
  const regular = new Set(cats.filter((c) => c.system === 'subs' || c.plan_kind === 'regular' || c.recurring).map((c) => c.id));
  const first = data[0]?.ym;
  const today = dateKey(Date.now() / 1000);
  const last = nowYm > `${year}-12` ? `${year}-12-31` : today;
  return {
    biggest: big ? { label: label(big.category_id), merchant: big.raw_merchant ?? '', day: dateKey(big.occurred_at), value: big.value } : null,
    subs: subscriptions(rows, subsId, data.length),
    frequent: frequentMerchant(rows),
    noSpend: first ? noSpendDays(rows, regular, `${first}-01`, last) : null,
  };
}
