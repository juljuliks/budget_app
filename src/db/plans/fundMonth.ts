// What a fund puts in this month and why, for its category's page and its row in the stats: what it asks, what the
// month's budget fitted (of it from "🔒 Отложить сразу"), what the next month asks then.
import { getDb } from '../index';
import { contributionOf, Fund, fundLedger, getFund } from './funds';
import { currentYm, parseYm, ymOf } from './months';

export type FundThisMonth = {
  fund: Fund;
  /** what it has now (this month's contribution and spending in) */
  saved: number;
  /** what it asks this month (left to save over the months left), in the fund's currency */
  asked: number;
  /** what goes in: all of it, or what the budget fitted */
  put: number;
  /** of `put`, from 🔒 — in the budget's currency (`takenCurrency`) */
  taken: number;
  takenCurrency: string | null;
  /** the next month: what it asks then (more, when this month put less) */
  next: { ym: string; asked: number };
};

/** null — the category has no fund now. */
export async function fundThisMonth(categoryId: number, nowYm = currentYm()): Promise<FundThisMonth | null> {
  const fund = await getFund(categoryId);
  if (!fund || fund.closed_ym || fund.since_ym > nowYm) return null;
  const { months, balance } = await fundLedger(fund, nowYm, nowYm);
  const m = months[months.length - 1];
  const db = await getDb();
  const item = await db.get<{ taken: number; c: string | null }>(
    "SELECT p.taken_minor AS taken, pm.budget_currency AS c FROM plan_items p LEFT JOIN plan_months pm ON pm.ym = p.ym WHERE p.ym = ? AND p.category_id = ? AND p.kind = 'fund'",
    [nowYm, categoryId]);
  const { year, month } = parseYm(nowYm);
  const next = ymOf(year, month + 1);
  return {
    fund,
    saved: balance,
    asked: m ? contributionOf(fund, nowYm, m.start) : 0,
    put: m?.contribution ?? 0,
    taken: item?.taken ?? 0,
    takenCurrency: item?.c ?? null,
    next: { ym: next, asked: contributionOf(fund, next, m ? m.end : fund.start_minor) },
  };
}
