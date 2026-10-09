// The questions of the merchant card.
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';

export const money = (totals: Array<{ currency: string; amount_minor: number }>) =>
  totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');

/** Turning "Разные категории" on: what each new operation will do, what happens to the merchant's category. */
export function mixedText(merchant: string, names: string[], pinned: string | null) {
  return {
    title: names.length ? `Разные категории у «${merchant}»: ${names.map((n) => `«${n}»`).join(', ')}` : `Разные категории у «${merchant}»`,
    message: `Каждая новая операция «${merchant}» будет спрашивать категорию${names.length ? ' — в уведомлении кнопками будут эти категории' : ''}. `
      + 'Категория, выбранная для операции, добавится к ним. '
      + (pinned ? `Категория мерчанта «${pinned}» открепится, у прошлых операций она останется.` : 'У прошлых операций категории не изменятся.'),
  };
}

export function removeText(merchant: string, count: number) {
  return {
    title: `Удалить мерчанта «${merchant}»?`,
    message: `${count} ${plural(count, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
      + 'Новые операции этого мерчанта не будут получать категорию автоматически. Новые SMS от него снова создадут мерчанта.',
  };
}
