// "Копилки": will each one make it by its date? The funds take what the months leave in turn, the nearest date first
// (one date — the smaller sum first): what is free in the plan, then 🔒. A month with a plan — its own; the months after
// the last one — as the current one. No React.
import { getDb } from '../index';
import { currentYm, parseYm, ymOf } from './months';
import { planConverter, plannedTotal, storedBudget } from './budget';
import { activeFunds, contributionOf, Fund, fundLedger } from './funds';

/** The queue of the funds: the nearest date first, one date — the smaller sum, then the older category. */
export function fundOrder(
  a: Pick<Fund, 'due' | 'target_minor' | 'category_id'>,
  b: Pick<Fund, 'due' | 'target_minor' | 'category_id'>,
): number {
  return a.due < b.due ? -1 : a.due > b.due ? 1 : a.target_minor - b.target_minor || a.category_id - b.category_id;
}

const nextYm = (ym: string) => {
  const { year, month } = parseYm(ym);
  return ymOf(year, month + 1);
};
/** the last day of a month: «30 сентября 2027» */
export const monthEnd = (ym: string) => {
  const { year, month } = parseYm(ym);
  return `${ym}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
};

/** What a month leaves to the funds, in one currency: free in the plan (its other items aside) and 🔒. */
export type MonthRoom = { ym: string; free: number; locked: number };
/** A fund in the same currency: how much, by when (its month), what it has at the start of the first month. */
export type SimFund = { id: number; target: number; dueYm: string; saved: number };
/** The first month: what it asks, what it gets of the free part and of 🔒, what was left for it. */
export type SimNow = { asked: number; fromFree: number; fromLocked: number; free: number; locked: number };

/**
 * The months from the first room on, each fund in turn (`funds` in the queue's order) asking its contribution and taking
 * what is left of the free part, then of 🔒; past the rooms given — the first one again. `extend`: that fund goes on after
 * its date (asking all it lacks) till it has its sum. Returns each fund's sum at its date, the first month and, for
 * `extend`, the month it has its sum in (null — not within 10 years).
 */
export function simulateFunds(funds: SimFund[], rooms: MonthRoom[], extend?: number) {
  const bal = new Map(funds.map((f) => [f.id, f.saved]));
  const atDue = new Map<number, number>();
  const now = new Map<number, SimNow>();
  let reached: string | null = null;
  const last = funds.reduce((m, f) => (f.dueYm > m ? f.dueYm : m), rooms[0].ym);
  const until = extend === undefined ? last : ymOf(parseYm(last).year + 10, parseYm(last).month);
  for (let ym = rooms[0].ym, i = 0; ym <= until && (extend === undefined || reached === null); ym = nextYm(ym), i++) {
    const room = rooms[i] ?? { ...rooms[0], ym };
    let free = Math.max(0, room.free);
    let locked = Math.max(0, room.locked);
    for (const f of funds) {
      const has = bal.get(f.id)!;
      const past = ym > f.dueYm;
      if (past && f.id !== extend) continue;
      const asked = past
        ? Math.max(0, f.target - has)
        : contributionOf({ target_minor: f.target, due: f.dueYm }, ym, has);
      const fromFree = Math.min(asked, free);
      const fromLocked = Math.min(asked - fromFree, locked);
      if (i === 0) now.set(f.id, { asked, fromFree, fromLocked, free, locked });
      free -= fromFree;
      locked -= fromLocked;
      bal.set(f.id, has + fromFree + fromLocked);
      if (ym === f.dueYm) atDue.set(f.id, bal.get(f.id)!);
      if (f.id === extend && bal.get(f.id)! >= f.target) reached = ym;
    }
  }
  return { atDue, now, reached };
}

type FundStatus = 'ok' | 'late' | 'full';
/** A fund's forecast, in its own currency. */
export type FundForecast = {
  category_id: number;
  currency: string;
  target: number;
  due: string;
  saved: number;
  /** ok — it has its sum by its date; late — less; full — nothing is left for it this month */
  status: FundStatus;
  /** this month: what it asks, what it gets of the free part and of 🔒, what is left for it of each */
  asked: number;
  fromFree: number;
  fromLocked: number;
  free: number;
  locked: number;
  /** what it has by its date in this pace (whole units) */
  forecast: number;
  /** late: the first month's end it has its sum by in this pace ('YYYY-MM-DD'; null — not within 10 years) */
  moveTo: string | null;
};

/** Each open fund's forecast (by its category); none — the current month has no budget. */
export async function fundForecasts(nowYm = currentYm()): Promise<Map<number, FundForecast>> {
  const out = new Map<number, FundForecast>();
  const budget = await storedBudget(nowYm);
  const db = await getDb();
  const funds = (await activeFunds(nowYm, db)).filter((f) => !f.closed_ym).sort(fundOrder);
  if (!budget || !funds.length) return out;
  const cur = budget.currency;
  const conv = await planConverter(nowYm);
  const to = (v: number, from: string, into: string) => (from === into ? v : (conv(v, from, into) ?? v));
  // the months planned from this one on: what each leaves to the funds
  const yms = (
    await db.all<{ ym: string }>('SELECT ym FROM plan_months WHERE ym >= ? AND budget_minor IS NOT NULL ORDER BY ym', [
      nowYm,
    ])
  ).map((r) => r.ym);
  const rooms: MonthRoom[] = [];
  for (let ym = nowYm; yms.includes(ym); ym = nextYm(ym)) {
    const b = (await storedBudget(ym))!;
    const fundItems = await db.all<{ v: number; c: string; t: number }>(
      "SELECT limit_minor AS v, currency AS c, taken_minor AS t FROM plan_items WHERE ym = ? AND kind = 'fund'",
      [ym],
    );
    const fundsPlanned = fundItems.reduce((a, i) => a + to(i.v, i.c, b.currency), 0);
    const taken = fundItems.reduce((a, i) => a + i.t, 0);
    const others = (await plannedTotal(ym, undefined, b.currency)) - fundsPlanned;
    rooms.push({
      ym,
      free: to(b.plannable_minor - others - taken, b.currency, cur),
      locked: to(b.locked_minor + taken, b.currency, cur),
    });
  }
  const sims: SimFund[] = [];
  for (const f of funds) {
    const months = (await fundLedger(f, nowYm, nowYm)).months;
    const start = months[months.length - 1]?.start ?? f.start_minor;
    sims.push({
      id: f.category_id,
      target: to(f.target_minor, f.currency, cur),
      dueYm: f.due.slice(0, 7),
      saved: to(start, f.currency, cur),
    });
  }
  const main = simulateFunds(sims, rooms);
  for (const [i, f] of funds.entries()) {
    const s = sims[i];
    const n = main.now.get(s.id) ?? { asked: 0, fromFree: 0, fromLocked: 0, free: 0, locked: 0 };
    const at = main.atDue.get(s.id) ?? s.saved;
    const ok = at >= s.target;
    const back = (v: number) => to(v, cur, f.currency);
    const moved = ok ? null : simulateFunds(sims, rooms, s.id).reached;
    out.set(f.category_id, {
      category_id: f.category_id,
      currency: f.currency,
      target: f.target_minor,
      due: f.due,
      saved: back(s.saved),
      status: ok ? 'ok' : n.free + n.locked <= 0 ? 'full' : 'late',
      asked: back(n.asked),
      fromFree: back(n.fromFree),
      fromLocked: back(n.fromLocked),
      free: back(n.free),
      locked: back(n.locked),
      forecast: Math.min(f.target_minor, Math.floor(back(at) / 100) * 100),
      moveTo: moved ? monthEnd(moved) : null,
    });
  }
  return out;
}

/** One fund's forecast (null — none open, or no budget this month). */
export async function fundForecast(categoryId: number, nowYm = currentYm()): Promise<FundForecast | null> {
  return (await fundForecasts(nowYm)).get(categoryId) ?? null;
}
