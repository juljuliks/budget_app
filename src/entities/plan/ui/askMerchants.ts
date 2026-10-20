// "По мерчантам" picked in the plan's sheet: an operation is picked for its first merchant's payment; the category's own
// payment (if it has one) — asked first, it goes when that payment is saved (savePayment), not before.
import { sheetAlert } from '@/shared/ui/sheetAlert';
import type { PlanAmountTarget } from './PlanAmountModal';

export function askMerchants(target: PlanAmountTarget, go: () => void): false {
  if (!target.own) { go(); return false; }
  sheetAlert(
    'Перейти на платежи по мерчантам?',
    `Платёж «${target.label}» удалится, когда сохраните платёж из операции; отложенное на него уйдёт в сбережения месяца.`,
    [{ text: 'Отмена', style: 'cancel' }, { text: 'Выбрать операцию', onPress: go }]);
  return false;
}
