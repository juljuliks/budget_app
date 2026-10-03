export type Kind = 'purchase' | 'payment' | 'refund' | 'withdrawal' | 'transfer' | 'deposit';

/**
 * Kinds whose merchant is a real merchant, so a category can be remembered for it (merchant rules).
 * Not transfers / deposits (the "merchant" is a person or the card), refunds or ATM withdrawals.
 */
export const REMEMBERABLE_KINDS: ReadonlyArray<Kind> = ['purchase', 'payment'];

export function isRememberable(kind: string): boolean {
  return (REMEMBERABLE_KINDS as ReadonlyArray<string>).includes(kind);
}

export interface ParsedTx {
  bank: string;
  kind: Kind;
  amount_minor: number;
  /** ISO 4217 code: GEL, USD, EUR */
  currency: string;
  raw_merchant?: string;
  merchant_key?: string;
  counterparty?: string;
  /** Local date-time from the SMS text ("2026-09-28T13:49:00", no zone); absent if the SMS has no valid date */
  occurred_at?: string;
  /** false when the SMS has a date but no time (occurred_at is then midnight) */
  has_time: boolean;
  raw_sms?: string;
}
