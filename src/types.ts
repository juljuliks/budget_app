export type Kind = 'purchase' | 'refund' | 'withdrawal' | 'transfer' | 'deposit';

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
