// The question "for this operation or for the merchant?".
import type { merchantChangePreview } from '@/assign';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';

type Change = NonNullable<Awaited<ReturnType<typeof merchantChangePreview>>>;

export function merchantChoiceText(change: Change, fromLabel: string | null, toLabel: string) {
  const sum = change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
  const now = fromLabel ? `Сейчас у мерчанта «${fromLabel}». ` : 'У мерчанта пока нет категории. ';
  return {
    title: `Категория «${toLabel}» — для этой операции или для мерчанта «${change.merchant}»?`,
    message: `${now}Для мерчанта: категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${sum}, и новые операции мерчанта будут получать её автоматически. Выбранные вручную категории не изменятся.`,
  };
}
