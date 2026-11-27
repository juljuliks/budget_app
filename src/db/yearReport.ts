// «Итоги года»: a year month by month (what came in, was spent, put aside, its share of the budget) and in all (the
// savings planned and put aside, the funds, where the money went, the impulsive purchases). The
// spending is read once for the year (not monthStats in a loop): tests/logic/statsQueries.test.ts.
import { getDb } from './index';
import { Currency, dateKey } from './fx';
import { categoryLabel } from './categories';
import { allFunds, currentYm, lockedPctSetting, planHistory } from './plans';
import { convertSpending, spendRows } from './plans/spend';
import { impulseRows } from './impulseStats';
import { impulseSummary, ImpulseSummary } from '../stats/impulse';
import { fullMonths, monthAverage, TopCategory, topCategories, YearRow } from '../stats/yearFacts';
import { fundsOfYear, reasonOf, savedInOf, yearIncome, yearLimits, yearMonths, yearSavings } from './yearReportParts';

/** 'future' — not begun; 'none' — before the first operation or plan; 'data' — a month to show. */
export type YearMonth = {
  ym: string;
  state: 'future' | 'none' | 'data';
  income: number;
  spent: number;
  /** with a plan (a budget or an amount): its report opens; without — only what came in and was spent */
  hasPlan: boolean;
  budget: number | null;
  saved: number | null;
  /** put aside of the budget, % (null — no budget) */
  pct: number | null;
};
type YearPlanFact = { plan: number; fact: number };
export type YearReport = {
  year: number;
  currency: Currency;
  months: YearMonth[];
  /** the months with data so far; `over` — the year is over */
  count: number;
  over: boolean;
  /** a month's spending on average over the full ones (as the stats': over, data from the 1st); null — none yet */
  average: { minor: number; months: number } | null;
  income: number;
  spent: number;
  saved: number;
  budget: number;
  funds: number;
  planMonths: number;
  /** what the year would put aside at this pace (null — over, or nothing to go on) */
  pace: number | null;
  goalPct: number | null;
  best: { ym: string; saved: number; pct: number | null } | null;
  worst: { ym: string; saved: number; reason: string | null } | null;
  /** the closed months' savings: planned and put aside */
  savings: {
    locked: YearPlanFact;
    rest: YearPlanFact;
    funds: YearPlanFact;
    total: YearPlanFact;
    months: number;
  } | null;
  fundsNow: Array<{
    id: number;
    label: string;
    saved: number;
    target: number;
    currency: string;
    due: string;
    ok: boolean | null;
  }>;
  top: Array<TopCategory & { label: string }>;
  /** every category spent in (not the funds' or transfers'): its month on average and overspends (the stats' list) */
  byCategory: Map<number, TopCategory>;
  impulse: ImpulseSummary | null;
  /** «Отложено» is said in the budget currency of the year's last month with a budget (yearCurrency): null — the same */
  savedIn: { currency: Currency; rate: number } | null;
};

const unix = (y: number, m: number) => new Date(y, m, 1).getTime() / 1000;

/**
 * What a year's report is in: the budget's currency of its last month with a budget (the budgets may have been in
 * different ones); none — `fallback` (the app's).
 */
export async function yearCurrency(year: number, fallback: Currency, nowYm = currentYm()): Promise<Currency> {
  const last = nowYm < `${year}-12` ? nowYm : `${year}-12`;
  const c = (
    await (
      await getDb()
    ).get<{ c: string }>(
      'SELECT budget_currency AS c FROM plan_months WHERE ym >= ? AND ym <= ? AND budget_minor IS NOT NULL ORDER BY ym DESC LIMIT 1',
      [`${year}-01`, last],
    )
  )?.c;
  return c === 'GEL' || c === 'USD' || c === 'EUR' ? c : fallback;
}

export async function yearReport(year: number, currency: Currency, nowYm = currentYm()): Promise<YearReport> {
  const db = await getDb();
  const [from, to] = [unix(year, 0), unix(year + 1, 0)];
  const history = new Map((await planHistory(nowYm, currency)).map((m) => [m.ym, m]));
  const cats = await db.all<{
    id: number;
    name: string;
    emoji: string | null;
    type_name: string | null;
    transfer: number;
  }>(
    `SELECT c.id, c.name, c.emoji, ct.name AS type_name, coalesce(ct.is_transfer, 0) AS transfer
      FROM categories c LEFT JOIN category_types ct ON ct.id = c.type_id`,
  );
  const label = (id: number | null) => {
    const c = cats.find((x) => x.id === id);
    return c ? categoryLabel(c) : 'Без категории';
  };
  const funds = await allFunds();
  const fundIds = new Set(funds.map((f) => f.category_id));
  const transferIds = new Set(cats.filter((c) => c.transfer).map((c) => c.id));

  // the year's spending, once
  const { items, conv } = await convertSpending(await spendRows(from, to), currency);
  const rows: YearRow[] = items.map(({ row: r, value }) => ({
    value,
    own: r.amount_minor,
    currency: r.currency,
    category_id: r.category_id,
    kind: r.kind,
    occurred_at: r.occurred_at,
    merchant_key: r.merchant_key ?? null,
    raw_merchant: r.raw_merchant ?? null,
  }));
  const income = await yearIncome(rows, from, to, currency, conv, transferIds);

  const limits = await yearLimits(year, currency, conv);

  const months = yearMonths(year, nowYm, history, income);
  const data = months.filter((m) => m.state === 'data');
  const firstAt = (await db.get<{ at: number | null }>('SELECT min(occurred_at) AS at FROM transactions'))?.at ?? null;
  const full = fullMonths(
    data.map((m) => m.ym),
    nowYm,
    firstAt === null ? null : dateKey(firstAt),
  );
  const avg = monthAverage(rows, full);
  const budgeted = data.filter((m) => m.saved !== null);
  const sum = (list: YearMonth[], f: (m: YearMonth) => number) => list.reduce((a, m) => a + f(m), 0);
  const saved = sum(budgeted, (m) => m.saved!);
  const over = nowYm > `${year}-12`;
  const left = over ? 0 : months.filter((m) => m.state === 'future').length;
  const byBest = [...budgeted].sort((a, b) => b.saved! - a.saved!);
  const worst = budgeted.length > 1 ? byBest[byBest.length - 1] : null;
  return {
    year,
    currency,
    months,
    count: data.length,
    over,
    average: avg === null ? null : { minor: avg, months: full.length },
    income: sum(data, (m) => m.income),
    spent: sum(data, (m) => m.spent),
    saved,
    budget: sum(budgeted, (m) => m.budget!),
    funds: data.reduce((a, m) => a + (history.get(m.ym)?.funds_minor ?? 0), 0),
    planMonths: data.filter((m) => m.hasPlan).length,
    pace: !over && budgeted.length ? Math.round(saved + (saved / budgeted.length) * left) : null,
    goalPct: await lockedPctSetting(),
    best: byBest.length > 1 ? { ym: byBest[0].ym, saved: byBest[0].saved!, pct: byBest[0].pct } : null,
    worst: worst
      ? { ym: worst.ym, saved: worst.saved!, reason: reasonOf(worst.ym, rows, limits, fundIds, transferIds, label) }
      : null,
    savings: await yearSavings(
      data.filter((m) => m.ym < nowYm).map((m) => m.ym),
      currency,
      nowYm,
    ),
    fundsNow: await fundsOfYear(funds, year, nowYm, label),
    top: topCategories(rows, limits, full, new Set([...fundIds, ...transferIds])).map((c) => ({
      ...c,
      label: label(c.id),
    })),
    byCategory: new Map(
      topCategories(rows, limits, full, new Set([...fundIds, ...transferIds]), null).map((c) => [c.id, c]),
    ),
    impulse: ((s) => (s.answered ? s : null))(impulseSummary(await impulseRows(from, to, currency))),
    savedIn: await savedInOf(year, currency, nowYm, conv),
  };
}
