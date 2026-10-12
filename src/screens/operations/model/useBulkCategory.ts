// "Категория (N)" for the selected operations: like for one, asks first when their merchants have another category.
import { useState } from 'react';
import { assignCategoryToMany, MerchantChoice, merchantsChangePreview } from '@/categorize/assign';
import { categoryLabel, getCategory } from '@/db/categories';
import { countSplit } from '@/db/parts';
import { sortOutMerchantText } from '@/features/category-delete';
import { showLimitAlert } from '@/notifications/notifeeIntegration';
import { plural } from '@/shared/lib/format';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { bulkMerchantText, bulkSplitText } from '../texts';

type Options = {
  selected: Set<number>;
  /** a sort-out going on: its category (the merchants move with this month only) */
  sortOut: { id: number; label: string } | null;
  /** the operations may leave the list: it is drawn anew */
  onMovedOut: () => void;
  onDone: () => void;
};

export function useBulkCategory({ selected, sortOut, onMovedOut, onDone }: Options) {
  const [open, setOpen] = useState(false);

  async function assign(categoryId: number | null, choice?: MerchantChoice) {
    try {
      onMovedOut();
      const merchants = await assignCategoryToMany([...selected], categoryId, choice, sortOut?.id);
      showLimitAlert(categoryId);
      const n = selected.size;
      const c = categoryId === null ? undefined : await getCategory(categoryId);
      const ops = `${n} ${plural(n, ['операция', 'операции', 'операций'])}`;
      toast(c
        ? `Категория «${categoryLabel(c)}» назначена: ${ops}${merchants ? ` и ${merchants} ${plural(merchants, ['мерчанту', 'мерчантам', 'мерчантам'])}` : ''}`
        : `Категория убрана: ${ops}`);
      onDone();
    } catch (e) {
      console.error('bulk assign failed', e);
      toastError('Не удалось сохранить');
    }
  }

  // split ones among them go whole into it: asked first (sorting out moves only their part in the category deleted)
  async function apply(categoryId: number | null) {
    setOpen(false);
    const split = sortOut ? 0 : await countSplit([...selected]).catch((e) => { console.error('split count failed', e); return 0; });
    if (split === 0) { await applyWhole(categoryId); return; }
    const to = categoryId === null ? undefined : await getCategory(categoryId);
    const t = bulkSplitText(split, to ? categoryLabel(to) : null);
    sheetAlert(t.title, t.message, [
      { text: 'Отмена', style: 'cancel' },
      { text: t.ok, onPress: () => { applyWhole(categoryId); } },
    ]);
  }

  async function applyWhole(categoryId: number | null) {
    const change = await merchantsChangePreview([...selected], categoryId).catch((e) => { console.error('preview failed', e); return null; });
    if (!change) { await assign(categoryId); return; }
    const to = await getCategory(categoryId!);
    const toLabel = to ? categoryLabel(to) : '?';
    // sorting out: the merchants move with this month only, the past stays in the category being deleted
    const t = sortOut ? sortOutMerchantText(toLabel, sortOut.label, change.merchants, selected.size) : bulkMerchantText(change, toLabel, selected.size);
    sheetAlert(t.title, t.message, [
      { text: 'Отмена', style: 'cancel' },
      { text: t.only, onPress: () => { assign(categoryId, 'only'); } },
      { text: t.also, style: 'secondary', onPress: () => { assign(categoryId, 'merchant'); } },
    ]);
  }

  return { open, setOpen, apply };
}
