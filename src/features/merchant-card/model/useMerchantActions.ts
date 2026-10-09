// "Сохранить" (what the choice means first, then save) and "Удалить мерчанта".
import { useEffect, useState } from 'react';
import { merchantFollowers, MerchantDetails } from '@/db/merchants';
import { plural } from '@/shared/lib/format';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { mixedText, money, removeText } from '../texts';
import { removeMerchant, saveMixed, saveSingle } from './commands';

type Card = {
  m: MerchantDetails | null;
  mixed: boolean;
  single: number | null;
  list: number[];
  dirty: boolean;
  label: (id: number) => Promise<string>;
  load: () => void;
};

export function useMerchantActions(merchantId: string | null, { m, mixed, single, list, dirty, label, load }: Card, onClose: () => void) {
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSaving(false); }, [merchantId]);

  // saved: the card is done
  const run = (apply: () => Promise<void>) => {
    setSaving(true);
    apply().then(() => { load(); onClose(); }).catch((e) => { console.error('save merchant failed', e); toastError('Не удалось сохранить'); })
      .finally(() => setSaving(false));
  };
  const confirm = (title: string, message: string, apply: () => Promise<void>) => sheetAlert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Продолжить', onPress: () => run(apply) },
  ]);

  async function save() {
    if (!m || !dirty) return;
    if (mixed) {
      const t = mixedText(m.name, await Promise.all(list.map(label)), m.category_id !== null ? await label(m.category_id) : null);
      confirm(t.title, t.message, async () => {
        await saveMixed(m.id, list);
        toast(`«${m.name}»: разные категории`);
      });
      return;
    }
    const name = single === null ? null : await label(single);
    const apply = (past: 'change' | 'keep') => async () => {
      await saveSingle(m.id, single, m.mixed, past);
      toast(name ? `Категория «${name}» назначена мерчанту «${m.name}»` : `Новые операции «${m.name}» будут приходить без категории`);
    };
    // its first category, none for one of different categories: nothing to change in the past, no question
    if (m.category_id === null) {
      if (m.mixed && name) {
        confirm(`Категория «${name}» для «${m.name}»`, 'Новые операции мерчанта будут получать её автоматически. Разные категории выключатся.', apply('change'));
      } else run(apply('change'));
      return;
    }
    // another category or none: the past operations that followed the old one — changed with it, or kept as they are
    const followers = await merchantFollowers(m.id);
    if (followers.count === 0) { run(apply('change')); return; }
    const old = await label(m.category_id);
    const n = followers.count;
    sheetAlert(
      name ? `Категория «${name}» для «${m.name}»` : `Без категории для «${m.name}»`,
      `Новые операции будут ${name ? `получать «${name}»` : 'приходить без категории'}. Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        // the past ones: the new category (or none), or the one they have
        { text: name ?? NO_CATEGORY, onPress: () => run(apply('change')) },
        { text: old, style: 'secondary', onPress: () => run(apply('keep')) },
      ],
      `Какую категорию сделать для ${n} ${plural(n, ['прошлой операции', 'прошлых операций', 'прошлых операций'])} на ${money(followers.totals)}?`);
  }

  // its operations stay with their categories, without the merchant (as deleting from the merchants' list)
  function remove() {
    if (!m) return;
    const t = removeText(m.name, m.count);
    sheetAlert(t.title, t.message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить мерчанта', style: 'destructive', onPress: () => {
          removeMerchant(m.id).then(() => {
            onClose();
            toast(`Мерчант «${m.name}» удалён`);
          }).catch((e) => { console.error('delete merchant failed', e); toastError('Не удалось удалить'); });
        },
      },
    ]);
  }

  return { saving, save, remove };
}
