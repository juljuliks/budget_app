// Saving up for a subscription turned on and off. Each change counts "Подписки" in the plans of this month on again.
import { getDb } from '../index';
import { currentYm } from '../plans/months';
import { refreshSubscriptionItems } from '../plans/subscriptionItems';
import { openSaving, savingLedger } from './saving';

/** How to put a saving back as it was ("Отменить" in the toast). */
export type SavingUndo =
  | { kind: 'opened'; id: number }
  | { kind: 'closed'; id: number }
  | { kind: 'removed'; row: { id: number; sub_id: number; since_ym: string; start_minor: number }; contributions: Array<{ ym: string; minor: number }> };

/**
 * Saves up for the subscription from this month, "Уже отложено" `start`; already saving — `start` changes (what it
 * had before the app). null — nothing changed.
 */
export async function startSaving(subId: number, start: number, nowYm = currentYm()): Promise<SavingUndo | null> {
  const db = await getDb();
  const open = await openSaving(subId, db);
  if (open) {
    if (open.start_minor === start) return null;
    await db.run('UPDATE sub_savings SET start_minor = ? WHERE id = ?', [start, open.id]);
  } else {
    const r = await db.run('INSERT INTO sub_savings (sub_id, since_ym, start_minor) VALUES (?, ?, ?)', [subId, nowYm, start]);
    await refreshSubscriptionItems(nowYm);
    return { kind: 'opened', id: r.lastInsertRowid };
  }
  await refreshSubscriptionItems(nowYm);
  return null;
}

/** What turning the saving off gives back now (what it had at the month's start): 0 — none or nothing in it. */
export async function savedNow(subId: number, nowYm = currentYm()): Promise<number> {
  const open = await openSaving(subId);
  if (!open) return 0;
  return (await savingLedger({ ...open, closed_ym: nowYm }, nowYm, nowYm)).balance;
}

/**
 * Stops saving: what it had up to the month before goes to this month's savings (the month's "Подписки" spend that much
 * less), the subscription's charges are the months' again. One started this month is just gone. null — wasn't saving.
 */
export async function stopSaving(subId: number, nowYm = currentYm()): Promise<{ released: number; undo: SavingUndo } | null> {
  const db = await getDb();
  const open = await openSaving(subId, db);
  if (!open) return null;
  let out: { released: number; undo: SavingUndo };
  if (open.since_ym >= nowYm) {
    const contributions = await db.all<{ ym: string; minor: number }>('SELECT ym, minor FROM sub_contributions WHERE saving_id = ?', [open.id]);
    await db.run('DELETE FROM sub_contributions WHERE saving_id = ?', [open.id]);
    await db.run('DELETE FROM sub_savings WHERE id = ?', [open.id]);
    out = { released: 0, undo: { kind: 'removed', row: { id: open.id, sub_id: open.sub_id, since_ym: open.since_ym, start_minor: open.start_minor }, contributions } };
  } else {
    const { balance } = await savingLedger({ ...open, closed_ym: nowYm }, nowYm, nowYm, db);
    await db.run('UPDATE sub_savings SET closed_ym = ?, released_minor = ? WHERE id = ?', [nowYm, balance, open.id]);
    out = { released: balance, undo: { kind: 'closed', id: open.id } };
  }
  await refreshSubscriptionItems(nowYm);
  return out;
}

/** "Отменить": the saving back as it was before the change. */
export async function undoSaving(u: SavingUndo, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  if (u.kind === 'opened') {
    await db.run('DELETE FROM sub_contributions WHERE saving_id = ?', [u.id]);
    await db.run('DELETE FROM sub_savings WHERE id = ?', [u.id]);
  } else if (u.kind === 'closed') {
    await db.run('UPDATE sub_savings SET closed_ym = NULL, released_minor = NULL WHERE id = ?', [u.id]);
  } else {
    await db.run('INSERT INTO sub_savings (id, sub_id, since_ym, start_minor) VALUES (?, ?, ?, ?)', [u.row.id, u.row.sub_id, u.row.since_ym, u.row.start_minor]);
    for (const c of u.contributions) await db.run('INSERT INTO sub_contributions (saving_id, ym, minor) VALUES (?, ?, ?)', [u.row.id, c.ym, c.minor]);
  }
  await refreshSubscriptionItems(nowYm);
}
