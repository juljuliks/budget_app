// "Итоги месяца", step "Платежи": the month's one-off payments not paid (planned − spent in the category) — each moved
// to the next month («Перенести на декабрь»: its item there, its money in the leftover moved, so the next budget doesn't
// pay it) or not needed (its money stays the month's leftover).
import { getDb } from '../index';
import type { Currency } from '../fx';
import { asCurrency } from './months';
import { ensureMonthPlan, ownMonth } from './budget';
import type { MonthStats } from './stats';

export type PaymentChoice = 'next' | 'drop';

export type ClosePayment = {
  category_id: number;
  name: string;
  emoji: string | null;
  /** the item's own currency: the amounts below are in it */
  currency: Currency;
  planned_minor: number;
  paid_minor: number;
  unpaid_minor: number;
  /** not paid, in the close's (the budget's) currency */
  unpaid_budget_minor: number;
  /** null — not answered */
  choice: PaymentChoice | null;
};

type Conv = (minor: number, from: string, to: string) => number | null;

/** The month's one-off payments with something not paid, the answers given; `stats` in `currency` (the budget's). */
export async function closePayments(ym: string, stats: MonthStats, conv: Conv, currency: Currency): Promise<ClosePayment[]> {
  const db = await getDb();
  const rows = await db.all<{ category_id: number; limit_minor: number; currency: string; name: string; emoji: string | null; choice: PaymentChoice | null }>(
    `SELECT p.category_id, p.limit_minor, p.currency, c.name, c.emoji, cp.choice
      FROM plan_items p JOIN categories c ON c.id = p.category_id
      LEFT JOIN close_payments cp ON cp.ym = p.ym AND cp.category_id = p.category_id
      WHERE p.ym = ? AND p.kind = 'fixed' AND p.every IS NULL AND p.limit_minor > 0 AND c.recurring = 0
        AND c.plan_kind IS NOT 'regular' AND c.deleted_at IS NULL
      ORDER BY c.sort_order, c.name`, [ym]);
  const out: ClosePayment[] = [];
  for (const r of rows) {
    const cur = asCurrency(r.currency);
    const spent = Math.max(0, stats.categories.find((c) => c.category_id === r.category_id)?.spent_minor ?? 0);
    const paid = Math.min(r.limit_minor, conv(spent, currency, cur) ?? spent);
    const unpaid = r.limit_minor - paid;
    if (unpaid <= 0) continue;
    out.push({
      category_id: r.category_id, name: r.name, emoji: r.emoji, currency: cur, planned_minor: r.limit_minor, paid_minor: paid,
      unpaid_minor: unpaid, unpaid_budget_minor: conv(unpaid, cur, currency) ?? unpaid, choice: r.choice,
    });
  }
  return out;
}

/** What is moved on: the unpaid of those answered «Перенести», in the budget's currency. */
export const movedMinor = (payments: ClosePayment[]) =>
  payments.filter((p) => p.choice === 'next').reduce((a, p) => a + p.unpaid_budget_minor, 0);

/** «Перенести на …» / «Не нужен» of a payment of `ym`; null — unanswered again. */
export async function answerPayment(ym: string, categoryId: number, choice: PaymentChoice | null): Promise<void> {
  const db = await getDb();
  if (choice === null) { await db.run('DELETE FROM close_payments WHERE ym = ? AND category_id = ? AND applied = 0', [ym, categoryId]); return; }
  await db.run(
    `INSERT INTO close_payments (ym, category_id, choice) VALUES (?, ?, ?)
      ON CONFLICT(ym, category_id) DO UPDATE SET choice = excluded.choice WHERE close_payments.applied = 0`,
    [ym, categoryId, choice]);
}

/**
 * The month closed: those moved on stand in the next month's plan as one-off payments of what wasn't paid (one there
 * already — the sums add up), once each.
 */
export async function movePayments(ym: string, nextYm: string, payments: ClosePayment[]): Promise<void> {
  const moving = payments.filter((p) => p.choice === 'next');
  if (!moving.length) return;
  await ensureMonthPlan(nextYm);
  const db = await getDb();
  await db.transaction(async (t) => {
    for (const p of moving) {
      const done = await t.get<{ applied: number }>('SELECT applied FROM close_payments WHERE ym = ? AND category_id = ?', [ym, p.category_id]);
      if (done?.applied) continue;
      const there = await t.get<{ currency: string }>('SELECT currency FROM plan_items WHERE ym = ? AND category_id = ?', [nextYm, p.category_id]);
      if (there && asCurrency(there.currency) === p.currency) {
        await t.run('UPDATE plan_items SET limit_minor = limit_minor + ? WHERE ym = ? AND category_id = ?', [p.unpaid_minor, nextYm, p.category_id]);
      } else if (!there) {
        await t.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES (?, ?, ?, 'fixed', ?)",
          [nextYm, p.category_id, p.unpaid_minor, p.currency]);
      }
      await t.run('UPDATE close_payments SET applied = 1 WHERE ym = ? AND category_id = ?', [ym, p.category_id]);
    }
    await ownMonth(nextYm, t);
  });
}
