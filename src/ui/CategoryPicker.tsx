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
  /** null only comes from the "Без категории" chip (allowNone) */
  onSelect: (id: number | null) => void;
  /** adds a "Без категории" chip (selected when selectedId is null) */
  allowNone?: boolean;
  title?: string;
  /** gear next to the title (category management); off where we already are in category management */
  showSettings?: boolean;
  /** money transfers: categories of the transfer type come first; a new category gets that type */
  transferFirst?: boolean;
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
  selectedId, onSelect, allowNone = false, title = 'Категория', showSettings = true, transferFirst = false, excludeIds, newCategory, onNavigateAway, disabled, children,
}: Props) {
  const navigation = useRootNavigation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([listCategories(), getTransferTypeId()])
      .then(([cats, transferType]) => {
        // always all categories; for transfers the transfer-type ones go first
        setCategories(transferFirst
          ? [...cats.filter((c) => c.type_is_transfer === 1), ...cats.filter((c) => c.type_is_transfer !== 1)]
          : cats);
        setTransferTypeId(transferType);
      })
      .catch((e) => console.error('load categories failed', e));
  }, [transferFirst]);

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
        onSettings={showSettings ? () => go(() => navigation.navigate('Categories')) : undefined}
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
        {allowNone ? (
          <PickerChip label="Без категории" selected={selectedId === null} onPress={() => onSelect(null)} />
        ) : null}
        {children}
        <TouchableOpacity
          style={[styles.chip, styles.chipAction]}
          disabled={disabled}
          onPress={() => go(() => navigation.navigate('CategoryEdit', {
            ...newCategory,
            typeId: newCategory?.typeId ?? (transferFirst ? transferTypeId ?? undefined : undefined),
          }))}
        >
          <Text style={styles.chipActionText}>＋ Новая категория</Text>
        </TouchableOpacity>
      </View>
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
});
