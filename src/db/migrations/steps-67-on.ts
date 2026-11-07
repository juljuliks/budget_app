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
  const cats = await db.all<{ id: number; recurring: number }>('SELECT id, recurring FROM categories WHERE system IS NULL');
  for (const c of cats) {
    let kind: string | null = null;
    if (await db.get('SELECT 1 FROM funds WHERE category_id = ? AND closed_ym IS NULL', [c.id])) kind = 'fund';
    else if (c.recurring) kind = 'regular';
    else {
      const it = await db.get<{ kind: string; every: string | null }>(
        'SELECT kind, every FROM plan_items WHERE category_id = ? ORDER BY ym <= ? DESC, CASE WHEN ym <= ? THEN ym END DESC, ym LIMIT 1',
        [c.id, ym, ym]);
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
  const cats = await db.all<{ id: number }>("SELECT id FROM categories WHERE plan_kind = 'regular' AND recurring = 0 AND deleted_at IS NULL");
  for (const c of cats) {
    const it = await db.get<{ every: string; weekdays: number | null; unit_minor: number | null; currency: string; until: string | null }>(
      `SELECT every, weekdays, unit_minor, currency, until FROM plan_items WHERE category_id = ? AND kind = 'fixed' AND every IS NOT NULL
        ORDER BY ym <= ? DESC, CASE WHEN ym <= ? THEN ym END DESC, ym LIMIT 1`, [c.id, ym, ym]);
    if (!it) continue;
    await db.run('INSERT INTO category_schedules (category_id, every, weekdays, unit_minor, currency, until) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, it.every, it.every === 'week' ? it.weekdays ?? 0 : null, it.unit_minor ?? 0, it.currency, it.until]);
  }
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
];
