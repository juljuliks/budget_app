// "Категория (N)" for the selected operations: like for one, asks first when their merchants have another category.
import { useState } from 'react';
import { assignCategoryToMany, MerchantChoice, merchantsChangePreview } from '@/assign';
import { categoryLabel, getCategory } from '@/db/categories';
import { sortOutMerchantText } from '@/features/category-delete';
import { showLimitAlert } from '@/notifications/notifeeIntegration';
import { plural } from '@/shared/lib/format';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { bulkMerchantText } from '../texts';

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

  async function apply(categoryId: number | null) {
    setOpen(false);
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
