// The category sheet's form: what is saved, the sections, the colors in use, the operations; saving it.
import { useCallback, useEffect, useState } from 'react';
import { Path, PathValue, useFormState, useWatch } from 'react-hook-form';
import { categoryLabel, categorySummary, findCategoryByName, getCategory, isRecurring, isSystemCategory } from '@/db/categories';
import { savedInCategory } from '@/db/subscriptions';
import { formatWithCurrency } from '@/shared/lib/money';
import { UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { CategoryType, listCategoryTypes } from '@/db/categoryTypes';
import { takenCategoryColors } from '@/db/colors';
import { submitForm, useLoadedForm } from '@/shared/ui/form';
import { setField } from '@/shared/ui/TextInputModal';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
import { CategoryFields, saveCategory, undoTurnOff } from './commands';
import { LOAD_FAILED } from '@/shared/lib/strings';

export type CategorySummary = { count: number; totals: Array<{ currency: string; amount_minor: number }> };

type Options = {
  visible: boolean;
  /** undefined = a new category */
  categoryId?: number;
  /** a new category's section */
  initialTypeId?: number;
  onClose: () => void;
  onSaved?: (id: number, created: boolean) => void;
};

/** "Выключить повторяющиеся платежи?" when they saved something (it goes to this month's savings); true — go on. */
async function confirmTurnOff(categoryId: number): Promise<boolean> {
  const saved = await savedInCategory(categoryId);
  if (!saved.length) return true;
  const list = saved.map((x) => `${x.name} — ${formatWithCurrency(x.minor, x.currency)}`).join(', ');
  return new Promise((resolve) => {
    sheetAlert(
      'Выключить повторяющиеся платежи?',
      `На платежи уже отложено: ${list}. Это уйдёт в сбережения месяца — как при удалении копилки. Сумма в плане останется, дальше — вручную.`,
      [{ text: 'Отмена', style: 'cancel', onPress: () => resolve(false) }, { text: 'Выключить', style: 'destructive', onPress: () => resolve(true) }]);
  });
}

export function useCategoryForm({ visible, categoryId, initialTypeId, onClose, onSaved }: Options) {
  const isNew = categoryId === undefined;
  const [summary, setSummary] = useState<CategorySummary | null>(null);
  // the category as saved (null while it loads); a new one starts empty. "Сохранить" shows once the form differs
  const [saved, setSaved] = useState<CategoryFields | null>(null);
  const form = useLoadedForm<CategoryFields>(saved, visible);
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const { name = '', emoji = '', typeId = null, color = null, recurring = false } = useWatch({ control: form.control });
  const set = <K extends Path<CategoryFields>>(k: K, v: PathValue<CategoryFields, K>) => setField(form, k, v);
  const [types, setTypes] = useState<CategoryType[]>([]);
  // colors other categories already have: not offered
  const [taken, setTaken] = useState<Set<string>>(new Set());
  // "Пополнение счёта", "Подписки"…: system categories, the name stays and they can't be deleted
  const [systemKind, setSystemKind] = useState<string | null>(null);

  const loadTypes = useCallback(() => {
    listCategoryTypes().then((t) => {
      setTypes(t);
      // the selected type was deleted meanwhile
      const cur = form.getValues('typeId');
      if (cur !== null && cur !== undefined && !t.some((x) => x.id === cur)) form.setValue('typeId', null);
    }).catch(toastFailure('load types', LOAD_FAILED));
  }, [form]);

  // on open: what is saved, its operations, the sections and the colors in use
  useEffect(() => {
    // nothing cleared on close: the sheet keeps its content while it slides away
    if (!visible) return;
    setSummary(null);
    loadTypes();
    takenCategoryColors(categoryId).then(setTaken).catch(toastFailure('load colors', LOAD_FAILED));
    setSystemKind(null);
    if (isNew) { setSaved({ name: '', emoji: '', typeId: initialTypeId ?? null, color: null, recurring: false }); return; }
    getCategory(categoryId).then((c) => {
      if (c) { setSaved({ name: c.name, emoji: c.emoji ?? '', typeId: c.type_id, color: c.color, recurring: isRecurring(c) }); setSystemKind(isSystemCategory(c) ? c.system : null); }
    }).catch(toastFailure('load category', LOAD_FAILED));
    categorySummary(categoryId).then(setSummary).catch(toastFailure('load category summary', LOAD_FAILED));
  }, [visible, categoryId, isNew, initialTypeId, loadTypes]);

  const save = submitForm(form, async (v) => {
    const trimmed = v.name.trim();
    try {
      if (await findCategoryByName(trimmed, v.typeId, categoryId)) {
        toastError('Такая категория уже есть');
        return;
      }
      // "Повторяющиеся платежи" off with something saved for them: asked first
      if (saved?.recurring && !v.recurring && categoryId !== undefined && !(await confirmTurnOff(categoryId))) return;
      const { id, undo } = await saveCategory(categoryId, { ...v, name: trimmed }, saved?.recurring ?? false);
      const label = categoryLabel({ name: trimmed, emoji: v.emoji || null });
      toast(isNew ? `Категория «${label}» создана` : `Категория «${label}» сохранена`, undo ? {
        label: UNDO, onPress: () => { undoTurnOff(undo).then(() => toast('Повторяющиеся платежи снова включены')).catch(toastFailure('undo recurring', 'Не удалось восстановить')); },
      } : undefined);
      onClose();
      onSaved?.(id, isNew);
    } catch (e) {
      console.error('save category failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return { form, isNew, isDirty, isSubmitting, name, emoji, typeId, color, recurring, set, types, loadTypes, taken, systemKind, summary, save };
}
