// Selecting several merchants (a long press) and giving them one category or deleting them.
import { useRef, useState } from 'react';
import { categoryLabelOf } from '@/db/categories';
import { MerchantRow, merchantsCategoryPreview } from '@/db/merchants';
import type { CategoryInfo } from '@/entities/category';
import { removeMerchants, saveMerchantsCategory } from '@/entities/merchant';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';

export function useMerchantBulk(merchants: MerchantRow[], categories: Map<number, CategoryInfo>) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  // Android also delivers a press when the finger lifts after a long press: skipped, it would unselect
  const longPressed = useRef(false);

  // a long press on a merchant starts selecting several, with it selected; unselecting the last one ends it
  function start(id: string) {
    longPressed.current = true;
    setSelectMode(true);
    setSelected([id]);
  }
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    if (next.length === 0) setSelectMode(false);
  }
  /** After a bulk action: out of the selection, the list reloads (onTransactionsChanged). */
  function done() {
    setSelectMode(false);
    setSelected([]);
  }

  // a merchant: its operations stay with their categories, without the merchant
  function confirmDelete() {
    const picked = merchants.filter((m) => selected.includes(m.id));
    const n = picked.reduce((a, m) => a + m.count, 0);
    const one = picked.length === 1;
    sheetAlert(
      one ? `Удалить мерчанта «${picked[0].name}»?` : `Удалить мерчантов (${picked.length})?`,
      `${n} ${plural(n, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
        + `Новые операции ${one ? 'этого мерчанта' : 'этих мерчантов'} не будут получать категорию автоматически. `
        + `Новые SMS от ${one ? 'него снова создадут мерчанта' : 'них снова создадут мерчантов'}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: one ? 'Удалить мерчанта' : `Удалить (${picked.length})`,
          style: 'destructive',
          onPress: () => {
            removeMerchants(picked.map((m) => m.id)).then(() => {
              done();
              toast(one ? `Мерчант «${picked[0].name}» удалён` : `Удалено мерчантов: ${picked.length}`);
            }).catch((e) => { console.error('delete merchants failed', e); toastError('Не удалось удалить'); });
          },
        },
      ]);
  }

  // one category for the selected merchants: what it changes, then save
  async function pickCategory(categoryId: number | null) {
    setPickOpen(false);
    if (categoryId === null) return;
    const picked = merchants.filter((m) => selected.includes(m.id));
    // a category just created from the picker isn't in the list yet
    const label = categories.get(categoryId)?.label ?? await categoryLabelOf(categoryId);
    const change = await merchantsCategoryPreview(picked.map((m) => m.id), categoryId)
      .catch((e) => { console.error('preview failed', e); return null; });
    const n = picked.length;
    const who = `${n} ${plural(n, ['мерчанта', 'мерчантов', 'мерчантов'])}`;
    sheetAlert(
      `Категория «${label}» для ${who}?`,
      `Новые операции ${n === 1 ? 'мерчанта' : 'этих мерчантов'} будут получать её автоматически.${change && change.count > 0
        ? ` Категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}.`
        : ''} Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить', onPress: () => {
            saveMerchantsCategory(picked.map((m) => m.id), categoryId).then(() => {
              done();
              toast(`Категория «${label}» назначена: ${n} ${plural(n, ['мерчант', 'мерчанта', 'мерчантов'])}`);
            }).catch((e) => { console.error('set merchants category failed', e); toastError('Не удалось сохранить'); });
          },
        },
      ]);
  }

  return { selectMode, selected, start, toggle, done, longPressed, confirmDelete, pickCategory, pickOpen, setPickOpen };
}
