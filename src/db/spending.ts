// What counts as spending, one rule for every query. Two views of it:
// - a category's: purchases, payments, withdrawals, transfers; refunds and deposits put in it subtract (money back);
// - a merchant's: its purchases and payments (what its category is remembered for, REMEMBERABLE_KINDS), minus refunds.
// A refund settled on its purchase (the purchase reduced or deleted, see refunds.ts) no longer counts by itself.
import { REMEMBERABLE_KINDS } from '../types';
import { sqlList } from './sql';

/** Kinds that are spending by themselves. */
export const EXPENSE_KINDS = ['purchase', 'payment', 'withdrawal', 'transfer'] as const;

/** `t.` before a column, or nothing. */
const col = (alias?: string) => (alias ? `${alias}.` : '');

/** A refund that counts by itself: not settled on its purchase. */
export const unsettledRefundSql = (alias?: string) => `(${col(alias)}kind = 'refund' AND ${col(alias)}refund_settled_at IS NULL)`;

/** An operation's amount as spending: refunds and deposits subtract. */
export const signedSpendSql = (alias?: string) =>
  `CASE WHEN ${col(alias)}kind IN ('refund', 'deposit') THEN -${col(alias)}amount_minor ELSE ${col(alias)}amount_minor END`;

/** The operations a category's spending is made of (a deposit in it: money back). */
export const categorySpendingSql = (alias?: string) =>
  `(${col(alias)}kind IN (${sqlList([...EXPENSE_KINDS, 'deposit'])}) OR ${unsettledRefundSql(alias)})`;

/** The operations a merchant's spending is made of. */
export const merchantSpendingSql = (alias?: string) =>
  `(${col(alias)}kind IN (${sqlList(REMEMBERABLE_KINDS)}) OR ${unsettledRefundSql(alias)})`;
