import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Category, categoryLabel } from '../db/categories';
import { useRootNavigation } from '../navigation';
import { colors } from './theme';

type Props = {
  categories: Category[];
  selectedId: number | null | undefined;
  onSelect: (id: number) => void;
  disabled?: boolean;
  /** passed to the category editor so a newly created category is assigned to this transaction */
  txId?: number;
  /** preselected type for a category created from here (transfer type for transfers) */
  newCategoryTypeId?: number | null;
};

/** Category chips + "new category". */
export default function CategoryPicker({ categories, selectedId, onSelect, disabled, txId, newCategoryTypeId }: Props) {
  const navigation = useRootNavigation();
  return (
    <View style={styles.chips}>
      {categories.map((c) => {
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
      <TouchableOpacity
        style={[styles.chip, styles.chipAction]}
        disabled={disabled}
        onPress={() => navigation.navigate('CategoryEdit', { txId, typeId: newCategoryTypeId ?? undefined })}
      >
        <Text style={styles.chipActionText}>＋ Новая категория</Text>
      </TouchableOpacity>
    </View>
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
