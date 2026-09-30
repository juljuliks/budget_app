export type Kind = 'purchase' | 'refund' | 'withdrawal' | 'transfer' | 'deposit';

export interface ParsedTx {
  bank: string;
  kind: Kind;
  amount_minor: number;
  currency: string;
  raw_merchant?: string;
  merchant_key?: string;
  counterparty?: string;
  occurred_at: string; // ISO
  raw_sms?: string;
}
