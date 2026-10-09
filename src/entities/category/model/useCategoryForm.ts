// The category sheet's form: what is saved, the sections, the colors in use, the operations; saving it.
import { useCallback, useEffect, useState } from 'react';
import { Path, PathValue, useFormState, useWatch } from 'react-hook-form';
import { categoryLabel, categorySummary, findCategoryByName, getCategory, isSystemCategory } from '@/db/categories';
import { CategoryType, listCategoryTypes } from '@/db/categoryTypes';
import { takenCategoryColors } from '@/db/colors';
import { submitForm, useLoadedForm } from '@/shared/ui/form';
import { setField } from '@/shared/ui/TextInputModal';
import { toast, toastError } from '@/shared/ui/toast';
import { CategoryFields, saveCategory } from './commands';

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

export function useCategoryForm({ visible, categoryId, initialTypeId, onClose, onSaved }: Options) {
  const isNew = categoryId === undefined;
  const [summary, setSummary] = useState<CategorySummary | null>(null);
  // the category as saved (null while it loads); a new one starts empty. "Сохранить" shows once the form differs
  const [saved, setSaved] = useState<CategoryFields | null>(null);
  const form = useLoadedForm<CategoryFields>(saved, visible);
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const { name = '', emoji = '', typeId = null, color = null } = useWatch({ control: form.control });
  const set = <K extends Path<CategoryFields>>(k: K, v: PathValue<CategoryFields, K>) => setField(form, k, v);
  const [types, setTypes] = useState<CategoryType[]>([]);
  // colors other categories already have: not offered
  const [taken, setTaken] = useState<Set<string>>(new Set());
  // "Сбережения", "Пополнение счёта": system categories, the name stays and they can't be deleted
  const [systemKind, setSystemKind] = useState<string | null>(null);

  const loadTypes = useCallback(() => {
    listCategoryTypes().then((t) => {
      setTypes(t);
      // the selected type was deleted meanwhile
      const cur = form.getValues('typeId');
      if (cur !== null && cur !== undefined && !t.some((x) => x.id === cur)) form.setValue('typeId', null);
    }).catch((e) => console.error('load types failed', e));
  }, [form]);

  // on open: what is saved, its operations, the sections and the colors in use
  useEffect(() => {
    // nothing cleared on close: the sheet keeps its content while it slides away
    if (!visible) return;
    setSummary(null);
    loadTypes();
    takenCategoryColors(categoryId).then(setTaken).catch((e) => console.error('load colors failed', e));
    setSystemKind(null);
    if (isNew) { setSaved({ name: '', emoji: '', typeId: initialTypeId ?? null, color: null }); return; }
    getCategory(categoryId).then((c) => {
      if (c) { setSaved({ name: c.name, emoji: c.emoji ?? '', typeId: c.type_id, color: c.color }); setSystemKind(isSystemCategory(c) ? c.system : null); }
    }).catch((e) => console.error('load category failed', e));
    categorySummary(categoryId).then(setSummary).catch((e) => console.error('load category summary failed', e));
  }, [visible, categoryId, isNew, initialTypeId, loadTypes]);

  const save = submitForm(form, async (v) => {
    const trimmed = v.name.trim();
    try {
      if (await findCategoryByName(trimmed, v.typeId, categoryId)) {
        toastError('Такая категория уже есть');
        return;
      }
      const id = await saveCategory(categoryId, { ...v, name: trimmed });
      const label = categoryLabel({ name: trimmed, emoji: v.emoji || null });
      toast(isNew ? `Категория «${label}» создана` : `Категория «${label}» сохранена`);
      onClose();
      onSaved?.(id, isNew);
    } catch (e) {
      console.error('save category failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return { form, isNew, isDirty, isSubmitting, name, emoji, typeId, color, set, types, loadTypes, taken, systemKind, summary, save };
}
