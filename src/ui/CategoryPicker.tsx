import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Category, categoryLabel, listCategories } from '../db/categories';
import { getTransferTypeId } from '../db/categoryTypes';
import { onTransactionsChanged } from '../events';
import { RootStackParamList, useRootNavigation } from '../navigation';
import SectionHeading from './SectionHeading';
import { colors } from './theme';

type Props = {
  selectedId?: number | null;
  onSelect: (id: number) => void;
  title?: string;
  /** money transfers: only categories of the transfer type; a new category gets that type */
  transferOnly?: boolean;
  /** categories not to offer (already in the plan, the one being deleted, ...) */
  excludeIds?: number[];
  /** what the category editor should do with a newly created category (assign to a transaction, add to a plan, ...) */
  newCategory?: Omit<RootStackParamList['CategoryEdit'], 'categoryId'>;
  /** called before leaving to the category screens (e.g. to close a modal) */
  onNavigateAway?: () => void;
  disabled?: boolean;
  /** extra chips after the categories, e.g. "Оставить без категории" */
  children?: React.ReactNode;
};

/**
 * The one category selector used wherever a category is set: title with a gear (category
 * management), category chips and "+ Новая категория". Loads categories itself and refreshes on
 * focus / changes, so a category created or edited elsewhere shows up immediately.
 */
export default function CategoryPicker({
  selectedId, onSelect, title = 'Категория', transferOnly = false, excludeIds, newCategory, onNavigateAway, disabled, children,
}: Props) {
  const navigation = useRootNavigation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([listCategories({ transferOnly }), getTransferTypeId()])
      .then(([cats, transferType]) => { setCategories(cats); setTransferTypeId(transferType); })
      .catch((e) => console.error('load categories failed', e));
  }, [transferOnly]);

  useFocusEffect(load);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const excluded = new Set(excludeIds ?? []);
  const shown = categories.filter((c) => !excluded.has(c.id));

  function go(fn: () => void) {
    onNavigateAway?.();
    fn();
  }

  return (
    <View>
      <SectionHeading
        title={title}
        onSettings={() => go(() => navigation.navigate('Categories'))}
        settingsLabel="Управление категориями"
      />
      <View style={styles.chips}>
        {shown.map((c) => {
          const selected = c.id === selectedId;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selected && styles.chipSelected]}
              disabled={disabled}
              onPress={() => onSelect(c.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{categoryLabel(c)}</Text>
            </TouchableOpacity>
          );
        })}
        {children}
        <TouchableOpacity
          style={[styles.chip, styles.chipAction]}
          disabled={disabled}
          onPress={() => go(() => navigation.navigate('CategoryEdit', {
            ...newCategory,
            typeId: newCategory?.typeId ?? (transferOnly ? transferTypeId ?? undefined : undefined),
          }))}
        >
          <Text style={styles.chipActionText}>＋ Новая категория</Text>
        </TouchableOpacity>
      </View>
      {transferOnly && shown.length === 0 ? (
        <Text style={styles.hint}>Для переводов нужна категория с типом «Переводы» — создайте её.</Text>
      ) : null}
    </View>
  );
}

/** Same look as a category chip, for extra options passed as children. */
export function PickerChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { color: '#FFFFFF' },
  chipAction: { backgroundColor: colors.bg, borderColor: colors.border, borderStyle: 'dashed' },
  chipActionText: { fontSize: 15, color: colors.accent },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
});
