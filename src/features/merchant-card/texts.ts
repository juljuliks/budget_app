// The questions of the merchant card.
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';

export const money = (totals: Array<{ currency: string; amount_minor: number }>) =>
  totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');

/** Turning "Разные категории" on: the first name is the primary category; what a new operation gets, what the past keeps. */
export function mixedText(merchant: string, names: string[], pinned: string | null) {
  const main = names[0];
  const listed = names.map((n) => `«${n}»`).join(', ');
  return {
    title: names.length ? `Разные категории у «${merchant}»: ${listed}` : `Разные категории у «${merchant}»`,
    message: (main
      ? `Новые операции «${merchant}» получат «${main}» — основную категорию. Уведомление всё равно спросит категорию — кнопками будут эти. Если не выбрать, останется «${main}». `
      : `Каждая новая операция «${merchant}» будет спрашивать категорию. `)
      + 'Категория, выбранная для операции, добавится к ним. '
      + (pinned && pinned !== main
        ? `Категория мерчанта «${pinned}» открепится, у прошлых операций она останется.`
        : 'У прошлых операций категории не изменятся.'),
  };
}

export function removeText(merchant: string, count: number) {
  return {
    title: `Удалить мерчанта «${merchant}»?`,
    message: `${count} ${plural(count, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
      + 'Новые операции этого мерчанта не будут получать категорию автоматически. Новые SMS от него снова создадут мерчанта.',
  };
}
