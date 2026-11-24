// The schema's history, migration 67 and on (shipped ones are never edited).
import type { Db } from '../types';
import type { MigrationStep } from './step';

/**
 * A category's kind from what its plan says now: an open fund — 'fund'; repeating payments — 'regular'; else its
 * item of this month, or of the last month that had it (a later one if none before): a limit — 'limit', a payment
 * within the month ("Каждый день" / "Каждую неделю") — 'regular', another payment — 'oneoff'. Never planned — none.
 */
async function categoryKinds(db: Db) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cats = await db.all<{ id: number; recurring: number }>(
    'SELECT id, recurring FROM categories WHERE system IS NULL',
  );
  for (const c of cats) {
    let kind: string | null = null;
    if (await db.get('SELECT 1 FROM funds WHERE category_id = ? AND closed_ym IS NULL', [c.id])) kind = 'fund';
    else if (c.recurring) kind = 'regular';
    else {
      const it = await db.get<{ kind: string; every: string | null }>(
        'SELECT kind, every FROM plan_items WHERE category_id = ? ORDER BY ym <= ? DESC, CASE WHEN ym <= ? THEN ym END DESC, ym LIMIT 1',
        [c.id, ym, ym],
      );
      if (it?.kind === 'limit') kind = 'limit';
      else if (it?.kind === 'fixed') kind = it.every ? 'regular' : 'oneoff';
      else if (it?.kind === 'subs') kind = 'regular';
    }
    if (kind) await db.run('UPDATE categories SET plan_kind = ? WHERE id = ?', [kind, c.id]);
  }
}

/**
 * A regular payment within the month moves from its plan item onto its category: the schedule of this month's item, or
 * of the last month's before (a later one if none), of each category whose kind is a regular payment.
 */
async function categorySchedules(db: Db) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cats = await db.all<{ id: number }>(
    "SELECT id FROM categories WHERE plan_kind = 'regular' AND recurring = 0 AND deleted_at IS NULL",
  );
  for (const c of cats) {
    const it = await db.get<{
      every: string;
      weekdays: number | null;
      unit_minor: number | null;
      currency: string;
      until: string | null;
    }>(
      `SELECT every, weekdays, unit_minor, currency, until FROM plan_items WHERE category_id = ? AND kind = 'fixed' AND every IS NOT NULL
        ORDER BY ym <= ? DESC, CASE WHEN ym <= ? THEN ym END DESC, ym LIMIT 1`,
      [c.id, ym, ym],
    );
    if (!it) continue;
    await db.run(
      'INSERT INTO category_schedules (category_id, every, weekdays, unit_minor, currency, until) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, it.every, it.every === 'week' ? (it.weekdays ?? 0) : null, it.unit_minor ?? 0, it.currency, it.until],
    );
  }
}

/**
 * 72: «🔒 Отложить сразу» is a % of the budget set in the settings. A month whose 🔒 was "MAX" (all that is free) keeps
 * the amount it has now; the setting's first % — from the last month with a budget (🔒 / budget, to the slider's 5%
 * stops, 5–30; none locked — not set); the current and coming months take it (their amounts stay till it changes).
 */
async function lockedPct(db: Db) {
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
    cover: number;
  }>(
    `SELECT ym, budget_minor AS budget, budget_currency AS currency, unplanned_pct AS pct, unplanned_minor AS own,
      unplanned_cover_minor AS cover FROM plan_months WHERE budget_minor IS NOT NULL AND locked_is_max = 1`,
  );
  for (const m of months) {
    const to = await rate(m.currency);
    const inBudget = async (minor: number, currency: string) => {
      const from = await rate(currency);
      return from === null || to === null ? 0 : Math.round((minor * from) / to);
    };
    let planned = 0;
    for (const i of await db.all<{ v: number; c: string }>(
      'SELECT limit_minor AS v, currency AS c FROM plan_items WHERE ym = ?',
      [m.ym],
    )) {
      planned += await inBudget(i.v, i.c);
    }
    const [y, mo] = m.ym.split('-').map(Number);
    const before = mo === 1 ? `${y - 1}-12` : `${y}-${p2(mo - 1)}`;
    const carry = await db.get<{ debt: number; plus: number; c: string }>(
      `SELECT carry_debt_minor AS debt, carry_plus_minor AS plus, carry_currency AS c FROM month_closes
        WHERE ym = ? AND closed_at IS NOT NULL AND carry_currency IS NOT NULL`,
      [before],
    );
    const carryDelta = carry ? await inBudget(carry.plus - carry.debt, carry.c) : 0;
    const share = (m.own ?? m.budget - Math.round((m.budget * (100 - m.pct)) / 100)) + m.cover;
    await db.run('UPDATE plan_months SET locked_minor = ?, locked_is_max = 0 WHERE ym = ?', [
      Math.max(0, m.budget - share - planned + carryDelta),
      m.ym,
    ]);
  }
  const last = await db.get<{ budget: number; locked: number }>(
    `SELECT budget_minor AS budget, locked_minor AS locked FROM plan_months WHERE budget_minor > 0
      ORDER BY ym <= ? DESC, CASE WHEN ym <= ? THEN ym END DESC, ym LIMIT 1`,
    [ym, ym],
  );
  if (!last || last.locked <= 0) return;
  const pct = Math.min(30, Math.max(5, Math.round((last.locked * 100) / last.budget / 5) * 5));
  await db.run(
    "INSERT INTO app_settings (key, value) VALUES ('locked_pct', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(pct)],
  );
  await db.run('UPDATE plan_months SET locked_pct = ? WHERE ym >= ?', [pct, ym]);
}

/** Migrations 67 and on. */
export const STEPS_67_ON: MigrationStep[][] = [
  // 67: a category's kind in the plan ("В плане" on its page) — what its item is and what a new month gets of it:
  // 'limit' (its amount and «Как тратите»), 'regular' (by its payments), 'oneoff' (nothing), 'fund'; null — not set
  [
    "ALTER TABLE categories ADD COLUMN plan_kind TEXT CHECK (plan_kind IN ('limit', 'regular', 'oneoff', 'fund'))",
    categoryKinds,
  ],
  // 68: "Итоги месяца", step "Платежи": a one-off payment not paid that month — moved to the next one ('next': its item
  // there, its money in the leftover moved; `applied` — the item written) or not needed ('drop')
  [
    `CREATE TABLE close_payments (
      ym TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      choice TEXT NOT NULL CHECK (choice IN ('next', 'drop')),
      applied INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ym, category_id)
    )`,
  ],
  // 69: a regular payment within the month ("Каждый день" / "Каждую неделю") is its category's: its schedule here (the
  // weekdays — Monday bit 0, the amount each time, its end); each month's item counted from it
  [
    `CREATE TABLE category_schedules (
      category_id INTEGER PRIMARY KEY,
      every TEXT NOT NULL CHECK (every IN ('day', 'week')),
      weekdays INTEGER,
      unit_minor INTEGER NOT NULL CHECK (unit_minor >= 0),
      currency TEXT NOT NULL,
      until TEXT
    )`,
    categorySchedules,
  ],
  // 70: the spending outside the plan past its share covered by a cut of the plan ("Покрыть перерасход"): on top of the
  // share, in the budget's currency, this month only (a new month doesn't carry it over)
  [
    'ALTER TABLE plan_months ADD COLUMN unplanned_cover_minor INTEGER NOT NULL DEFAULT 0 CHECK (unplanned_cover_minor >= 0)',
  ],
  // 71: a one-off payment's day in its month ("Дата списания", optional; YYYY-MM-DD): its mark on the stats' bar, the
  // month's pace counts it from that day (none — spread evenly over the month)
  ['ALTER TABLE plan_items ADD COLUMN due TEXT'],
  // 72: «🔒 Отложить сразу» — a % of the month's budget from the settings ('locked_pct'): the month's % (null — an amount
  // of its own: a past month, or no % set), what was taken from it this month for the plan and the repeating payments (a
  // fund's share is its item's taken_minor); no "MAX" any more
  [
    'ALTER TABLE plan_months ADD COLUMN locked_pct INTEGER CHECK (locked_pct BETWEEN 0 AND 100)',
    'ALTER TABLE plan_months ADD COLUMN locked_taken_minor INTEGER NOT NULL DEFAULT 0 CHECK (locked_taken_minor >= 0)',
    lockedPct,
  ],
];
