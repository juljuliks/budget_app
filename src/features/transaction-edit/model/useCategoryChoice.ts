// Picking the operation's category: for this operation only, or for its merchant too (asked when that changes others).
import { useEffect, useState } from 'react';
import { assignCategory, MerchantChoice, merchantChangePreview } from '@/assign';
import { categoryLabel, getCategory } from '@/db/categories';
import { showLimitAlert } from '@/notifications/notifeeIntegration';
import { merchantLabel } from '@/shared/lib/format';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { merchantChoiceText } from '../texts';
import type { Tx } from './useTransaction';

export function useCategoryChoice(txId: number, tx: Tx | null, visible: boolean, onClose: () => void) {
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setSaving(false); }, [visible, txId]);

  async function assign(categoryId: number | null, choice?: MerchantChoice) {
    setSaving(true);
    try {
      await assignCategory(txId, categoryId, choice);
      showLimitAlert(categoryId);
      const c = categoryId === null ? undefined : await getCategory(categoryId);
      if (!c) toast('Категория убрана');
      else if (choice === 'merchant' && tx) toast(`Категория «${categoryLabel(c)}» назначена мерчанту «${merchantLabel(tx)}»`);
      else toast(`Категория «${categoryLabel(c)}» назначена`);
      onClose();
    } catch (e) {
      console.error('assign category failed', e);
      toastError('Не удалось сохранить');
      setSaving(false);
    }
  }

  // A purchase / payment at a merchant with another category or none: ask whether the new one is for this
  // operation only (the usual choice) or becomes the merchant's (with what that changes), or nothing changes
  async function choose(categoryId: number | null) {
    if (saving) return;
    const change = await merchantChangePreview(txId, categoryId).catch((e) => { console.error('preview failed', e); return null; });
    if (!change) { await assign(categoryId); return; }
    const [from, to] = await Promise.all([change.fromCategoryId === null ? null : getCategory(change.fromCategoryId), getCategory(categoryId!)]);
    const t = merchantChoiceText(change, from ? categoryLabel(from) : null, to ? categoryLabel(to) : '?');
    sheetAlert(t.title, t.message, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Только для этой операции', onPress: () => { assign(categoryId, 'only'); } },
      { text: 'Для мерчанта', style: 'secondary', onPress: () => { assign(categoryId, 'merchant'); } },
    ]);
  }

  return { saving, choose };
}
