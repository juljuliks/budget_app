// A subscription's saving month by month, without the database: what each month put in, what its charges took, what
// they took past what was saved (the month's own spending). Like a fund's (db/plans/funds.ts), but the target moves on:
// each month saves for the charge it is for (savingFor), what is left of the subscription's amount over the months left.
import { contributionOf } from '../plans/funds';
import { monthRange, parseYm, ymOf } from '../plans/months';

export type SavingMonth = { ym: string; start: number; contribution: number; spent: number; shortage: number; end: number };

/** An operation of the subscription's merchant in "Подписки": its id, moment and value in the subscription's currency. */
export type SavingSpend = { id: number; at: number; value: number };

export type SavingInput = {
  /** first and last month, inclusive */
  since: string;
  last: string;
  nowYm: string;
  /** "Уже отложено" */
  start: number;
  /** one charge */
  amount: number;
  /** months with a plan: only they put something in */
  planned: (ym: string) => boolean;
  /** past months' contributions as their plans had them */
  stored: Map<string, number>;
  /** the charge the month saves for ('YYYY-MM-DD'); null — none (no day) */
  dueOf: (ym: string) => string | null;
  /** in time order */
  spends: SavingSpend[];
};

export type SavingResult = { months: SavingMonth[]; balance: number; byTx: Map<number, { before: number; after: number }> };

export const nextYm = (ym: string) => { const { year, month } = parseYm(ym); return ymOf(year, month + 1); };
export const ymBefore = (ym: string) => { const { year, month } = parseYm(ym); return ymOf(year, month - 1); };

/**
 * The months from `since` to `last`. A past month's contribution is the stored one (none stored: counted as the current
 * one's is); the current and coming ones': what is left of the amount over the months up to the charge, from what the
 * month starts with. A charge past what is saved: the rest is the month's (shortage).
 */
export function savingMonths(p: SavingInput): SavingResult {
  const months: SavingMonth[] = [];
  const byTx = new Map<number, { before: number; after: number }>();
  let balance = p.start;
  let i = 0;
  for (let ym = p.since; ym <= p.last; ym = nextYm(ym)) {
    const start = balance;
    const due = p.dueOf(ym);
    const counted = !p.planned(ym) || !due ? 0 : contributionOf({ target_minor: p.amount, due }, ym, balance);
    const contribution = ym < p.nowYm ? p.stored.get(ym) ?? counted : counted;
    balance += contribution;
    const [, end] = monthRange(parseYm(ym).year, parseYm(ym).month);
    let spent = 0;
    let shortage = 0;
    for (; i < p.spends.length && p.spends[i].at < end; i++) {
      const v = p.spends[i].value;
      const before = balance;
      spent += v;
      if (v > balance) { shortage += v - balance; balance = 0; } else balance -= v;
      byTx.set(p.spends[i].id, { before, after: balance });
    }
    months.push({ ym, start, contribution, spent, shortage, end: balance });
  }
  return { months, balance, byTx };
}
