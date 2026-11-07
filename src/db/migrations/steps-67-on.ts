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
];
