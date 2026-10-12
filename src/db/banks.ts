// Which banks are read (Настройки → "Банки"), and their cards' balances.
import { getDb } from './index';
import type { Db } from './types';
import { getSetting, setSetting } from './settings';
import { cardBalance, CardBalance } from './balance';
import { BANKS, BANKS_SETTING, BankId, DEFAULT_BANKS } from '../domain/banks';

/** The ids of the banks on, in BANKS' order. */
export async function enabledBanks(db?: Db): Promise<BankId[]> {
  db ??= await getDb();
  const v = await getSetting(BANKS_SETTING, db);
  let ids: string[] = DEFAULT_BANKS;
  try { if (v) ids = JSON.parse(v) as string[]; } catch { /* the default */ }
  return BANKS.filter((b) => ids.includes(b.id)).map((b) => b.id);
}

/** A bank on or off: off, its messages aren't read any more; its operations stay. At least one stays on. */
export async function setBankEnabled(id: BankId, on: boolean): Promise<BankId[]> {
  const db = await getDb();
  const now = await enabledBanks(db);
  const next = on ? [...new Set([...now, id])] : now.filter((b) => b !== id);
  if (next.length === 0) return now;
  const ordered = BANKS.filter((b) => next.includes(b.id)).map((b) => b.id);
  await setSetting(BANKS_SETTING, JSON.stringify(ordered), db);
  return ordered;
}

/** Each bank on with a known balance, its card's balance. */
export async function cardBalances(): Promise<Array<{ bank: BankId; balance: CardBalance }>> {
  const out: Array<{ bank: BankId; balance: CardBalance }> = [];
  for (const bank of await enabledBanks()) {
    const balance = await cardBalance(bank);
    if (balance) out.push({ bank, balance });
  }
  return out;
}
