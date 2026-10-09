// The new operation's form: clean on each open; a deposit goes to "Пополнение счёта" unless another is picked.
import { useEffect } from 'react';
import { useForm, useFormState, useWatch } from 'react-hook-form';
import { topUpCategoryId } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { addTransaction } from '@/entities/transaction';
import { showLimitAlert } from '@/notifications/notifeeIntegration';
import { DayKey, dayKeyOf, parseDayKey } from '@/shared/lib/dateRange';
import { parseAmountInput } from '@/shared/lib/money';
import { submitForm } from '@/shared/ui/form';
import { toast, toastError } from '@/shared/ui/toast';

export const KINDS = [['purchase', 'Расход'], ['deposit', 'Пополнение']] as const;
type Kind = typeof KINDS[number][0];
export type AddForm = { amount: string; kind: Kind; currency: Currency; description: string; date: DayKey; categoryId: number | null };

const empty = (): AddForm => ({ amount: '', kind: 'purchase', currency: 'GEL', description: '', date: dayKeyOf(new Date()), categoryId: null });

export function useAddForm(visible: boolean, onClose: () => void) {
  // a new operation: "Добавить" is always there (it creates one), the amount is checked on submit
  const form = useForm<AddForm>({ defaultValues: empty() });
  // a clean form each time it opens (no focus: the keyboard opens on a tap)
  useEffect(() => {
    if (visible) form.reset(empty());
  }, [visible, form]);
  const { isSubmitting: saving } = useFormState({ control: form.control });
  const date = useWatch({ control: form.control, name: 'date' });
  // a deposit goes to "Пополнение счёта" unless another is picked; a purchase can't be in it
  const kind = useWatch({ control: form.control, name: 'kind' });
  useEffect(() => {
    let live = true;
    topUpCategoryId().then((topUp) => {
      if (!live || topUp === null) return;
      const current = form.getValues('categoryId');
      if (kind === 'deposit' && current === null) form.setValue('categoryId', topUp);
      if (kind !== 'deposit' && current === topUp) form.setValue('categoryId', null);
    }).catch((e) => console.error('top-up category failed', e));
    return () => { live = false; };
  }, [kind, form]);

  const save = submitForm(form, async ({ amount, kind: k, currency, description, date: day, categoryId }) => {
    try {
      // today: now; another day: this time of day on it (no time is picked)
      const now = new Date();
      const at = parseDayKey(day);
      at.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
      await addTransaction({
        amount_minor: parseAmountInput(amount)!, currency, kind: k, description, category_id: categoryId,
        occurred_at: Math.floor(at.getTime() / 1000),
      });
      showLimitAlert(categoryId);
      toast('Операция добавлена');
      onClose();
    } catch (e) {
      console.error('add transaction failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return { form, saving, date, kind, save };
}
