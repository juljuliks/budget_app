// Impulsive purchases: a category's "Импульсивные покупки", an operation's answer to "Обдуманная" / "Импульсивная" and its
// "Настроение". Only collected for now: nothing counts them yet.
import { getDb } from './index';
import type { Db } from './types';
import type { Mood } from '../domain/moods';

/** "Импульсивные покупки" on or off: the category's operations ask "Обдуманная" / "Импульсивная". */
export async function setCategoryImpulse(id: number, on: boolean, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE categories SET impulse = ? WHERE id = ?', [on ? 1 : 0, id]);
}

/** The answer: true — impulsive, false — not, null — no answer (the chip tapped again). */
export async function setTransactionImpulse(id: number, impulse: boolean | null, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE transactions SET impulse = ? WHERE id = ?', [impulse === null ? null : impulse ? 1 : 0, id]);
}

/** "Настроение": a mood of domain/moods.ts, null — none (the chip tapped again). */
export async function setTransactionMood(id: number, mood: Mood | null, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE transactions SET mood = ? WHERE id = ?', [mood, id]);
}

/** An operation asks when its category, or a split part's, has "Импульсивные покупки" on (getTransaction's impulse_asked). */
export const IMPULSE_ASKED_COLUMN = `(coalesce(c.impulse, 0) = 1 OR EXISTS (SELECT 1 FROM transaction_parts ip
    JOIN categories ic ON ic.id = ip.category_id WHERE ip.tx_id = t.id AND ic.impulse = 1)) AS impulse_asked`;
