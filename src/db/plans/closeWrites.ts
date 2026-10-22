// "Итоги месяца" answered: each answer kept as given (the close can be left and come back to), the month closed when
// every question has one, its carry to the next month kept with it.
import { getDb } from '../index';
import { currentYm } from './months';
import { refreshFundItems, ymBefore } from './funds';
import { CloseAnswers, monthClose } from './close';

/**
 * A closed month's carry as its answers now make it (they were changed: "Изменить итоги", "Покрыть иначе?") — even
 * with a question opened by it ("В сбережения" asks "Удалось отложить?" again).
 */
async function keepCarry(ym: string, nowYm: string): Promise<void> {
  const c = await monthClose(ym, nowYm);
  if (!c.closed) return;
  await (await getDb()).run(
    'UPDATE month_closes SET confirmed_minor = ?, carry_debt_minor = ?, carry_plus_minor = ?, carry_currency = ? WHERE ym = ?',
    [c.saved_minor, c.carry.debt_minor, c.carry.plus_minor, c.budget?.currency ?? null, ym]);
}

/** The funds' parts of `ym` (each fund's in its currency); null — unanswered again. */
async function writeFunds(ym: string, parts: Array<{ category_id: number; minor: number }> | null, nowYm: string): Promise<void> {
  const db = await getDb();
  if (parts === null) await db.run('DELETE FROM fund_confirms WHERE ym = ?', [ym]);
  for (const p of parts ?? []) {
    await db.run(
      'INSERT INTO fund_confirms (category_id, ym, saved_minor) VALUES (?, ?, ?) ON CONFLICT(category_id, ym) DO UPDATE SET saved_minor = excluded.saved_minor',
      [p.category_id, ym, Math.max(0, p.minor)]);
  }
  // what they have changed: the current month's contributions count it
  await refreshFundItems(nowYm, nowYm);
}

/** A fund's contribution of `ym` by itself (what went in, 0 — none); null — unanswered again. */
export async function answerFund(ym: string, categoryId: number, minor: number | null, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  if (minor === null) await db.run('DELETE FROM fund_confirms WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  else await writeFunds(ym, [{ category_id: categoryId, minor }], nowYm);
  if (minor === null) await refreshFundItems(nowYm, nowYm);
  await keepCarry(ym, nowYm);
}

/** "Изменить распределение": the funds' parts of what was put aside by hand (the rest is the savings'). */
export async function setSplit(ym: string, parts: Array<{ category_id: number; minor: number }>, nowYm = currentYm()): Promise<void> {
  await writeFunds(ym, parts, nowYm);
  await keepCarry(ym, nowYm);
}

const COLUMNS: Array<keyof CloseAnswers> = [
  'over_cover', 'over_rest_cover', 'rest_choice', 'saved', 'saved_minor', 'by_balance', 'balance_minor', 'balance_open_minor',
];

/** Answers of the close of `ym` (the ones given; the others stay). */
export async function answerClose(ym: string, patch: Partial<CloseAnswers>, nowYm = currentYm()): Promise<void> {
  const keys = COLUMNS.filter((k) => k in patch);
  if (!keys.length) return;
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO month_closes (ym) VALUES (?)', [ym]);
  await db.run(`UPDATE month_closes SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ym = ?`, [...keys.map((k) => patch[k] ?? null), ym]);
  // what was put aside laid out again by itself (a split by hand is gone with a new answer)
  const c = await monthClose(ym, nowYm);
  await writeFunds(ym, c.auto ? c.auto.funds : null, nowYm);
  await keepCarry(ym, nowYm);
}

/** Closes `ym` if every question is answered (the defaults kept as answers). false — something is still unanswered. */
export async function finishClose(ym: string, nowYm = currentYm()): Promise<boolean> {
  const c = await monthClose(ym, nowYm);
  if (!c.complete) return false;
  const a = c.answers;
  await (await getDb()).run(
    `INSERT INTO month_closes (ym, over_cover, over_rest_cover, rest_choice, saved, saved_minor, confirmed_minor, closed_at,
        carry_debt_minor, carry_plus_minor, carry_currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ym) DO UPDATE SET over_cover = excluded.over_cover, over_rest_cover = excluded.over_rest_cover,
        rest_choice = excluded.rest_choice, saved = excluded.saved, saved_minor = excluded.saved_minor,
        confirmed_minor = excluded.confirmed_minor, closed_at = excluded.closed_at, carry_debt_minor = excluded.carry_debt_minor,
        carry_plus_minor = excluded.carry_plus_minor, carry_currency = excluded.carry_currency`,
    [ym, a.over_cover, a.over_rest_cover, a.rest_choice, a.saved, a.saved_minor, c.saved_minor, Math.floor(Date.now() / 1000),
      c.carry.debt_minor, c.carry.plus_minor, c.budget?.currency ?? null]);
  return true;
}

/** What the month before `ym` sent to it: an overspend owed, the leftover moved; in that month's budget's currency. */
export type Carry = { from_ym: string; debt_minor: number; plus_minor: number; currency: string };

export async function carryInto(ym: string): Promise<Carry | null> {
  const r = await (await getDb()).get<Carry>(
    `SELECT ym AS from_ym, carry_debt_minor AS debt_minor, carry_plus_minor AS plus_minor, carry_currency AS currency FROM month_closes
      WHERE ym = ? AND closed_at IS NOT NULL`, [ymBefore(ym)]);
  if (!r || !r.currency || (r.debt_minor === 0 && r.plus_minor === 0)) return null;
  return r;
}
