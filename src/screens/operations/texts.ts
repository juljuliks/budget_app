// The operations tab's questions.
import type { merchantsChangePreview } from '@/categorize/assign';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';

type Change = NonNullable<Awaited<ReturnType<typeof merchantsChangePreview>>>;

/** A category for the selected operations, some of whose merchants have another: for them only, or their merchants too. */
export function bulkMerchantText(change: Change, toLabel: string, selected: number) {
  const names = change.merchants.length > 3 ? `${change.merchants.slice(0, 2).join(', ')} и ещё ${change.merchants.length - 2}` : change.merchants.join(', ');
  const sum = change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
  const one = change.merchants.length === 1;
  return {
    title: `Категория «${toLabel}» — только для выбранных операций или и для ${one ? 'мерчанта' : 'мерчантов'}?`,
    // nothing of theirs follows them (all picked by hand): only the new operations change
    message: `${one ? `Для мерчанта «${names}»` : `Для мерчантов (${names})`}: ${change.count > 0 ? `категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${sum}, и новые` : 'новые'} операции будут получать её автоматически. Выбранные вручную категории не изменятся.`,
    only: `Только для выбранных (${selected})`,
    also: one ? 'И для мерчанта' : 'И для мерчантов',
  };
}

export const SEARCH_PLACEHOLDER = 'Поиск: мерчант, описание, сумма…';
export const EMPTY_FILTERED = 'Ничего не найдено.';
export const EMPTY = 'Операций пока нет. Они появятся здесь после SMS или уведомления банка, или добавьте вручную ＋.';

/** A category for the selected operations, some of them split: they go whole into it. */
export function bulkSplitText(split: number, toLabel: string | null) {
  return {
    title: split === 1 ? 'Одна из операций разделена' : `${split} ${plural(split, ['операция разделена', 'операции разделены', 'операций разделены'])}`,
    message: toLabel
      ? `Разделение уберётся: вся сумма перейдёт в «${toLabel}».`
      : 'Разделение уберётся: операции останутся без категории.',
    ok: 'Продолжить',
  };
}

/** Picking an operation for a category's repeating payment (the plan's "Выбрать операцию", "＋ Добавить платёж"). */
export const pickBanner = (label: string) => `Платёж «${label}»: выберите операцию`;
export const PICK_NOT_SPENDING = 'Это не трата — платёж делается из покупки, оплаты или перевода';
export const PICK_NO_MERCHANT = 'У операции нет мерчанта — по ней не узнать следующие списания. Выберите другую';
