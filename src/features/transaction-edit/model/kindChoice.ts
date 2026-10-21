// "Тип операции" of money that came in: a deposit (income) or a refund (money back for a purchase).
import type { IncomeKind } from '@/db/transactions';
import { changeIncomeKind } from '@/entities/transaction';
import { toast, toastFailure } from '@/shared/ui/toast';
import type { Tx } from './useTransaction';

/** The choices, with what each means. */
export const KIND_CHOICES: ReadonlyArray<readonly [IncomeKind, string, string]> = [
  ['deposit', 'Пополнение', 'Доход месяца, в «Пополнении счёта»'],
  ['refund', 'Возврат', 'Деньги за покупку: вычитается из её категории, можно разделить по категориям'],
];

/** Only these switch: a refund settled on its purchase stays one. */
export const canChangeKind = (tx: Pick<Tx, 'kind' | 'refund_settled_at'>) =>
  tx.kind === 'deposit' || (tx.kind === 'refund' && !tx.refund_settled_at);

/** Another type picked: changed (and the category, see setTransactionKind). */
export function pickKind(tx: Pick<Tx, 'id' | 'kind'>, kind: IncomeKind) {
  if (kind === tx.kind) return;
  changeIncomeKind(tx.id, kind)
    .then(() => toast(kind === 'refund' ? 'Теперь это возврат' : 'Теперь это пополнение'))
    .catch(toastFailure('change kind', 'Не удалось сменить тип'));
}
