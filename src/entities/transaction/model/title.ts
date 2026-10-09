import { KIND_LABELS } from '@/shared/lib/format';

/**
 * Row title: the type from the SMS and the merchant / person when known — "Пополнение · DEMID RIABOV",
 * "Оплата · TELMICO", "Перевод". A plain card purchase is just its merchant ("SPAR").
 */
export function merchantLabel(tx: { kind: string; raw_merchant: string | null }): string {
  const label = KIND_LABELS[tx.kind] ?? 'Операция';
  if (tx.kind === 'purchase') return tx.raw_merchant || label;
  return tx.raw_merchant ? `${label} · ${tx.raw_merchant}` : label;
}
