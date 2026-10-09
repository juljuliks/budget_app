import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Controller, Path, PathValue, useFormState, useWatch } from 'react-hook-form';
import {
  categoryLabel, categorySummary, createCategory, currentTransactionsOfCategory, findCategoryByName, getCategory, isSystemCategory, TOP_UP, updateCategory,
} from '../db/categories';
import { CategoryType, listCategoryTypes } from '../db/categoryTypes';
import { takenCategoryColors } from '../db/colors';
import { colorFromHue, distinctHue, freeCategoryColors } from '../colors';
import { emitTransactionsChanged } from '../events';
import { useRootNavigation } from '@/shared/navigation/navigation';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { confirmDeleteCategory } from './categoryActions';
import Chip from '@/shared/ui/Chip';
import ColorPickerSheet from '@/shared/ui/ColorPickerSheet';
import ColorSwatches from '@/shared/ui/ColorSwatches';
import EmojiPicker from '@/shared/ui/EmojiPicker';
import { submitForm, useLoadedForm } from '@/shared/ui/form';
import { toast, toastError } from '@/shared/ui/toast';
import { formStyles } from '@/shared/theme/formStyles';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import SectionHeading from '@/shared/ui/SectionHeading';
import { NO_SECTION } from '@/shared/lib/strings';
import { setField } from '@/shared/ui/TextInputModal';
import { colors } from '@/shared/theme/theme';
import TypeEditModal from './TypeEditModal';
import { openCategoryDelete } from '@/shared/navigation/sheets';

type CategoryForm = { name: string; emoji: string; typeId: number | null; color: string | null };

type Props = {
  visible: boolean;
  /** an existing category; undefined = a new one */
  categoryId?: number;
  /** a new category's section (e.g. "Переводы" when created for a transfer) */
  typeId?: number;
  /**
   * the short form ("+" next to a category list anywhere but the categories page): section (existing ones only),
   * emoji and name; the color is automatic. The full form is on the categories page.
   */
  quick?: boolean;
  onClose: () => void;
  /** after saving, with the category's id: a new one is then picked by the screen that opened the sheet */
  onSaved?: (id: number, created: boolean) => void;
  /** after deleting (no operations this month) */
  onDeleted?: () => void;
};

/**
 * A category in a sheet: create one (from the categories, or "+" next to any category list) or see / edit one —
 * its operations, section, emoji and name, color; delete it. The screen that opened it does the rest with a new
 * category's id (assigns it, selects it, moves operations into it) exactly as when an existing one is picked.
 */
export default function CategorySheet({ visible, categoryId, typeId: initialTypeId, quick, onClose, onSaved, onDeleted }: Props) {
  const navigation = useRootNavigation();
  const isNew = categoryId === undefined;
  const [summary, setSummary] = useState<{ count: number; totals: Array<{ currency: string; amount_minor: number }> } | null>(null);
  // the category as saved (null while it loads); a new one starts empty. "Сохранить" shows once the form differs
  const [saved, setSaved] = useState<CategoryForm | null>(null);
  const form = useLoadedForm<CategoryForm>(saved, visible);
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const { name = '', emoji = '', typeId = null, color = null } = useWatch({ control: form.control });
  const set = <K extends Path<CategoryForm>>(k: K, v: PathValue<CategoryForm, K>) => setField(form, k, v);
  const [types, setTypes] = useState<CategoryType[]>([]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // colors other categories already have: not offered
  const [taken, setTaken] = useState<Set<string>>(new Set());
  // "Сбережения", "Пополнение счёта": system categories, the name stays and they can't be deleted
  const [systemKind, setSystemKind] = useState<string | null>(null);
  const system = systemKind !== null;

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
      let id = categoryId;
      if (id === undefined) id = await createCategory(trimmed, v.emoji, v.typeId, v.color);
      else await updateCategory(id, { name: trimmed, emoji: v.emoji, typeId: v.typeId, color: v.color });
      emitTransactionsChanged();
      const label = categoryLabel({ name: trimmed, emoji: v.emoji || null });
      toast(isNew ? `Категория «${label}» создана` : `Категория «${label}» сохранена`);
      onClose();
      onSaved?.(id, isNew);
    } catch (e) {
      console.error('save category failed', e);
      toastError('Не удалось сохранить');
    }
  });

  // no operations this month: a confirmation sheet; otherwise the sheet that moves them first
  async function remove() {
    const [c, current] = await Promise.all([getCategory(categoryId!), currentTransactionsOfCategory(categoryId!)]);
    if (!c) return;
    if (current.length > 0) { onClose(); openCategoryDelete(c.id); return; }
    confirmDeleteCategory(c, () => { onClose(); onDeleted?.(); });
  }

  function showOperations() {
    onClose();
    // the Operations tab filtered by this category, back returns to the categories
    navigation.navigate({ name: 'Main', params: { screen: 'Transactions', params: { category: categoryId, nonce: Date.now(), from: 'Categories' } } } as never);
  }

  // the type's shades first: a type reads as one color family on the charts
  const colorOptions = freeCategoryColors(types, typeId, taken, color);
  const typeOptions: Array<[number | null, string]> = [[null, NO_SECTION], ...types.map((t): [number, string] => [t.id, t.name])];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isNew ? 'Новая категория' : 'Категория'} style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isNew && summary ? (
          // like a merchant's card: how many operations and how much spent; with some, a link to them
          <View style={styles.summaryRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {summary.count} {plural(summary.count, ['операция', 'операции', 'операций'])}
              {summary.totals.length ? ` · ${summary.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}` : ''}
            </Text>
            {summary.count > 0 ? (
              <TouchableOpacity onPress={showOperations} hitSlop={8} accessibilityRole="link">
                <Text style={styles.link}>Показать операции ›</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {/* types are managed in the settings; a new one can be made right here */}
        <SectionHeading title="Раздел" />
        <View style={styles.chips}>
          {typeOptions.map(([id, label]) => (
            <Chip key={String(id)} label={label} selected={typeId === id} onPress={() => set('typeId', id)} />
          ))}
          {quick ? null : <Chip label="Новый раздел" add onPress={() => setTypeOpen(true)} />}
        </View>

        {/* the emoji (a tile opening the grid: one emoji, no typing) and the name in one row */}
        <Text style={formStyles.label}>Название</Text>
        <View style={styles.nameRow}>
          <View>
            <TouchableOpacity style={[formStyles.input, styles.emoji]} onPress={() => setEmojiOpen(true)} accessibilityLabel={emoji ? `Эмодзи ${emoji}, изменить` : 'Выбрать эмодзи'}>
              <Text style={emoji ? styles.emojiText : styles.emojiPlaceholder}>{emoji || '＋'}</Text>
            </TouchableOpacity>
            {/* without an emoji */}
            {emoji ? (
              <TouchableOpacity style={styles.emojiClear} onPress={() => set('emoji', '')} hitSlop={8} accessibilityLabel="Убрать эмодзи">
                <Text style={styles.emojiClearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Controller
            control={form.control}
            name="name"
            rules={{ validate: (v) => !!v?.trim() || 'Введите название' }}
            render={({ field }) => (
              <TextInput
                style={[formStyles.input, styles.name]}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Например, Спорт"
                placeholderTextColor={colors.muted}
                maxLength={40}
                editable={!system}
                returnKeyType="done"
                onSubmitEditing={isNew || isDirty ? save : undefined}
              />
            )}
          />
        </View>
        {system ? (
          <Text style={styles.quickHint}>
            {systemKind === TOP_UP
              ? 'Системная категория: сюда попадают все пополнения карты — деньги, которые пришли за месяц и которые вы распределяете. Это не траты. Если пополнение — возврат долга от человека, перенесите его в категорию переводов. Название не меняется, удалить её нельзя.'
              : 'Системная категория: сюда уходит то, что бюджет месяца оставил (не запланировано и не потрачено). Операции в ней — отложенные деньги, не траты. Название не меняется, удалить её нельзя.'}
          </Text>
        ) : null}
        {name.trim() ? (
          <Text style={styles.preview}>
            Будет выглядеть так: {categoryLabel({ emoji, name: name.trim(), type_name: types.find((t) => t.id === typeId)?.name })}
          </Text>
        ) : null}

        {quick ? (
          <Text style={styles.quickHint}>Цвет подберётся сам. Изменить категорию полностью можно в Настройки → Категории.</Text>
        ) : (
          <>
            <Text style={formStyles.label}>Цвет</Text>
            {/* "Авто" generates a color (another one on each press) that no other category has */}
            <ColorSwatches
              options={colorOptions}
              value={color}
              onChange={(c) => set('color', c)}
              onAuto={() => set('color', colorFromHue(distinctHue(taken, color)))}
              // "+": any color of its own in the picker sheet (it then shows among the swatches, selected)
              onCustom={() => setPickerOpen(true)}
            />
          </>
        )}

        <SheetActions
          // a new category: always (it's created); an existing one: greyed until something changed. "Отмена" only next to
          // a single action: with "Удалить категорию" too, three buttons — the sheet closes by swiping down
          submit={{ title: isNew ? 'Создать' : 'Сохранить', onPress: save, disabled: isSubmitting || (!isNew && !isDirty) }}
          extra={isNew || system ? undefined : [{ title: 'Удалить категорию', onPress: remove, danger: true }]}
          onCancel={isNew || system ? onClose : undefined}
        />
      </SheetScrollView>

      <EmojiPicker visible={emojiOpen} value={emoji} onPick={(e) => set('emoji', e)} onClose={() => setEmojiOpen(false)} />
      <ColorPickerSheet visible={pickerOpen} value={color} onPick={(c) => set('color', c)} onClose={() => setPickerOpen(false)} />
      <TypeEditModal
        visible={typeOpen}
        types={types}
        onClose={() => setTypeOpen(false)}
        // the new type is selected for this category
        onSaved={(id) => { setTypeOpen(false); set('typeId', id); loadTypes(); }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  meta: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 14, color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  nameRow: { flexDirection: 'row', gap: 10 },
  name: { flex: 1 },
  emoji: { width: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  emojiText: { fontSize: 24, color: '#000000' },
  emojiPlaceholder: { fontSize: 22, color: colors.muted },
  emojiClear: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  emojiClearText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  preview: { color: colors.muted, marginTop: 6, fontSize: 13 },
  quickHint: { color: colors.muted, marginTop: 14, fontSize: 13, lineHeight: 18 },
});
