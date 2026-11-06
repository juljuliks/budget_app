// Impulsive purchases: a category's "Импульсивные покупки", an operation's answer to "Обдуманная" / "Импульсивная" and,
// for an impulsive one, its "Что подтолкнуло?" (a mood). Counted by db/impulseStats.ts.
import { getDb } from './index';
import type { Db } from './types';
import type { Mood } from '../domain/moods';
import { REMEMBERABLE_KINDS } from '../domain/types';
import { sqlList } from './sql';

/** "Импульсивные покупки" on or off: the category's operations ask "Обдуманная" / "Импульсивная". */
export async function setCategoryImpulse(id: number, on: boolean, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE categories SET impulse = ? WHERE id = ?', [on ? 1 : 0, id]);
}

/**
 * The answer: true — impulsive, false — not, null — no answer (the chip tapped again). Only an impulsive one keeps its
 * "Что подтолкнуло?": the mood goes with any other answer (its row is hidden then).
 */
export async function setTransactionImpulse(id: number, impulse: boolean | null, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE transactions SET impulse = ?, mood = CASE WHEN ? = 1 THEN mood END WHERE id = ?',
    [impulse === null ? null : impulse ? 1 : 0, impulse ? 1 : 0, id]);
}

/** "Что подтолкнуло?": a mood of domain/moods.ts, null — none (the chip tapped again). */
export async function setTransactionMood(id: number, mood: Mood | null, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE transactions SET mood = ? WHERE id = ?', [mood, id]);
}

/** Operations asked "Обдуманная" / "Импульсивная" with no answer yet: the operations list's "Покупка: без ответа". */
export const UNANSWERED_SQL = `SELECT x.id FROM transactions x WHERE x.impulse IS NULL AND x.kind IN (${sqlList(REMEMBERABLE_KINDS)})
  AND (x.category_id IN (SELECT id FROM categories WHERE impulse = 1)
    OR x.id IN (SELECT p.tx_id FROM transaction_parts p JOIN categories pc ON pc.id = p.category_id WHERE pc.impulse = 1))`;

/** An operation asks when its category, or a split part's, has "Импульсивные покупки" on (getTransaction's impulse_asked). */
export const IMPULSE_ASKED_COLUMN = `(coalesce(c.impulse, 0) = 1 OR EXISTS (SELECT 1 FROM transaction_parts ip
    JOIN categories ic ON ic.id = ip.category_id WHERE ip.tx_id = t.id AND ic.impulse = 1)) AS impulse_asked`;
