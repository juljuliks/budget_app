// The schema's history, migrations 60 and on (shipped ones are never edited).
import type { MigrationStep } from './step';
import type { Db } from '../types';

/**
 * 🔒 picked as "MAX" before 60 (or saved after it by a sheet that opened on "MAX" without the flag) is a fixed amount
 * that was all that is free then; the rate moved since. The current and coming months whose 🔒 is all that is free
 * within 1% of the budget (budget − share − planned + the month before's carry, by today's rate) follow it again.
 */
async function lockedMaxAgain(db: Db) {
  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
  const today = `${ym}-${p2(now.getDate())}`;
  const rate = async (currency: string) =>
    currency === 'GEL'
      ? 1
      : ((
          await db.get<{ g: number }>(
            'SELECT gel_per_unit AS g FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1',
            [currency, today],
          )
        )?.g ?? null);
  const months = await db.all<{
    ym: string;
    budget: number;
    currency: string;
    pct: number;
    own: number | null;
    locked: number;
  }>(
    `SELECT ym, budget_minor AS budget, budget_currency AS currency, unplanned_pct AS pct, unplanned_minor AS own, locked_minor AS locked
      FROM plan_months WHERE ym >= ? AND budget_minor IS NOT NULL AND locked_minor > 0 AND locked_is_max = 0`,
    [ym],
  );
  for (const m of months) {
    const to = await rate(m.currency);
    if (!to) continue;
    const inBudget = async (minor: number, currency: string) => {
      const from = await rate(currency);
      return from === null ? null : (minor * from) / to;
    };
    let planned = 0;
    for (const i of await db.all<{ v: number; c: string }>(
      'SELECT limit_minor AS v, currency AS c FROM plan_items WHERE ym = ?',
      [m.ym],
    )) {
      const v = await inBudget(i.v, i.c);
      if (v === null) {
        planned = NaN;
        break;
      }
      planned += v;
    }
    const [y, mo] = m.ym.split('-').map(Number);
    const before = mo === 1 ? `${y - 1}-12` : `${y}-${p2(mo - 1)}`;
    const carry = await db.get<{ debt: number; plus: number; c: string }>(
      `SELECT carry_debt_minor AS debt, carry_plus_minor AS plus, carry_currency AS c FROM month_closes
        WHERE ym = ? AND closed_at IS NOT NULL AND carry_currency IS NOT NULL`,
      [before],
    );
    const carryDelta = carry ? await inBudget(carry.plus - carry.debt, carry.c) : 0;
    const share = m.own ?? m.budget - Math.round((m.budget * (100 - m.pct)) / 100);
    const free = m.budget - share - planned + (carryDelta ?? NaN);
    if (Number.isFinite(free) && free > 0 && Math.abs(free - m.locked) <= m.budget / 100) {
      await db.run('UPDATE plan_months SET locked_minor = 0, locked_is_max = 1 WHERE ym = ?', [m.ym]);
    }
  }
}

/**
 * 63: a coming month made before it began kept what the month before had then (a budget's currency changed later). Such a
 * month follows the one before now (plan_months.follows), its budget always. Those made already, this month on: the
 * budget of the month before when it had none or the same amount in another currency (a funds' items come in each look).
 */
async function followingMonths(db: Db) {
  const now = new Date();
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  type Month = {
    ym: string;
    budget_minor: number | null;
    budget_currency: string;
    unplanned_pct: number;
    to_savings: number;
    locked_minor: number;
    unplanned_minor: number | null;
    locked_is_max: number;
  };
  const all = await db.all<Month>('SELECT * FROM plan_months ORDER BY ym');
  for (let i = 1; i < all.length; i++) {
    const [before, m] = [all[i - 1], all[i]];
    if (m.ym < nowYm) continue;
    if (before.budget_minor === null) continue;
    if (m.budget_minor === null) {
      Object.assign(m, { ...before, ym: m.ym });
      await db.run(
        `UPDATE plan_months SET budget_minor = ?, budget_currency = ?, unplanned_pct = ?, to_savings = ?, locked_minor = ?, unplanned_minor = ?,
          locked_is_max = ? WHERE ym = ?`,
        [
          m.budget_minor,
          m.budget_currency,
          m.unplanned_pct,
          m.to_savings,
          m.locked_minor,
          m.unplanned_minor,
          m.locked_is_max,
          m.ym,
        ],
      );
    } else if (m.budget_minor === before.budget_minor && m.budget_currency !== before.budget_currency) {
      m.budget_currency = before.budget_currency;
      await db.run('UPDATE plan_months SET budget_currency = ? WHERE ym = ?', [m.budget_currency, m.ym]);
    }
  }
}

/**
 * 65: "📺 Подписки" a system category again (system = 'subs'), the only one with subscriptions: the one with the most of
 * them (by name "Подписки" next; else a new one). Another category with "Подписки" on: its subscriptions and their
 * merchants' rules move to it (past operations stay where they are), its plan items of them from this month a one-off
 * payment with the amount they had. "Подписки" has no fund (closed this month) and no "Импульсивные покупки".
 */
async function subscriptionsSystem(db: Db) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rows = await db.all<{ id: number; name: string; by_merchant: number; n: number }>(
    `SELECT c.id, c.name, c.by_merchant, (SELECT count(*) FROM recurring_payments r
        WHERE r.category_id = c.id AND r.merchant_key IS NOT NULL AND r.deleted_at IS NULL) AS n
      FROM categories c WHERE c.deleted_at IS NULL AND (c.system IS NULL OR c.system = 'subs') ORDER BY c.id`,
  );
  // by name in JS: SQLite's lower() leaves Cyrillic as it is
  const named = (r: { name: string }) => r.name.trim().toLowerCase() === 'подписки';
  const on = rows.filter((r) => r.by_merchant);
  const target =
    [...on].sort((a, b) => b.n - a.n || Number(named(b)) - Number(named(a)) || a.id - b.id)[0] ?? rows.find(named);
  let id = target?.id;
  if (id === undefined)
    id = (
      await db.run(
        "INSERT INTO categories (name, emoji, system, sort_order, by_merchant) VALUES ('Подписки', '📺', 'subs', 7, 1)",
      )
    ).lastInsertRowid;
  await db.run("UPDATE categories SET system = 'subs', by_merchant = 1, impulse = 0 WHERE id = ?", [id]);
  for (const o of on.filter((r) => r.id !== id)) {
    const keys = await db.all<{ k: string }>(
      'SELECT merchant_key AS k FROM recurring_payments WHERE category_id = ? AND merchant_key IS NOT NULL AND deleted_at IS NULL',
      [o.id],
    );
    await db.run('UPDATE recurring_payments SET category_id = ? WHERE category_id = ? AND merchant_key IS NOT NULL', [
      id,
      o.id,
    ]);
    for (const { k } of keys)
      await db.run(
        "UPDATE merchant_rules SET category_id = ? WHERE match_type = 'exact' AND pattern = ? AND category_id = ?",
        [id, k, o.id],
      );
    await db.run("UPDATE plan_items SET kind = 'fixed' WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [
      o.id,
      ym,
    ]);
    await db.run('UPDATE categories SET by_merchant = 0 WHERE id = ?', [o.id]);
  }
  await db.run('UPDATE funds SET closed_ym = ? WHERE category_id = ? AND closed_ym IS NULL', [ym, id]);
}

/** Migrations 60 and on: a new one is appended to the last file (when it nears 250 lines, the next file starts). */
export const STEPS_60_ON: MigrationStep[][] = [
  // 60: "locked MAX" flag: re-derive the locked amount from the free budget each time, so it follows rate/plan changes
  ['ALTER TABLE plan_months ADD COLUMN locked_is_max INTEGER NOT NULL DEFAULT 0'],
  // 61: "Из сбережений" takes 🔒, then the funds' contributions, then the savings from before. A month closed before
  // keeps what 🔒 alone covered (the rest as answered then) until its overspend is answered again
  [
    'ALTER TABLE month_closes ADD COLUMN locked_cover INTEGER NOT NULL DEFAULT 0',
    'UPDATE month_closes SET locked_cover = 1 WHERE closed_at IS NOT NULL',
  ],
  // 62: a 🔒 that is all that is free (the rate moved it off a little) is "MAX" again: it follows the plan and the rate
  [lockedMaxAgain],
  // 63: a coming month made before it began follows the months before it till changed by hand or begun
  ['ALTER TABLE plan_months ADD COLUMN follows INTEGER NOT NULL DEFAULT 0', followingMonths],
  // 64: "Импульсивные покупки" on a category's page: its operations ask "Обдуманная" / "Импульсивная" (transactions.impulse:
  // 1 — yes, 0 — no, null — not answered) and "Настроение" (transactions.mood: an id of domain/moods.ts, null — none)
  [
    'ALTER TABLE categories ADD COLUMN impulse INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE transactions ADD COLUMN impulse INTEGER',
    'ALTER TABLE transactions ADD COLUMN mood TEXT',
  ],
  [subscriptionsSystem],
  // 66: a fund's contribution fits the month's budget (funds.ts, refreshFundItems): cap_minor — what fitted when less
  // than it asks (null — all of it), taken_minor — the part of it taken from "🔒 Отложить сразу" (in the budget's currency)
  [
    'ALTER TABLE plan_items ADD COLUMN cap_minor INTEGER',
    'ALTER TABLE plan_items ADD COLUMN taken_minor INTEGER NOT NULL DEFAULT 0',
  ],
];
