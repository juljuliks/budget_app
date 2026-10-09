import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryInfo, CategoryPicker, CategoryPickerModal } from '@/entities/category';
import Chip from '@/shared/ui/Chip';
import SectionHeading from '@/shared/ui/SectionHeading';
import { PencilIcon } from '@/shared/ui/icons';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';

type Props = {
  name: string;
  /** the saved category (null: none yet) */
  savedCategoryId: number | null;
  categories: Map<number, CategoryInfo>;
  mixed: boolean;
  single: number | null;
  list: number[];
  saving: boolean;
  toggle: (id: number | null) => void;
  setSingle: (id: number | null) => void;
};

/**
 * The merchant's category: one it has — with "Сменить" (every category in a sheet), as on an operation; different
 * ones — its list (✕ takes one off) and "Добавить категорию"; none yet — the categories right here.
 */
export default function MerchantCategories({ name, savedCategoryId, categories, mixed, single, list, saving, toggle, setSingle }: Props) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!mixed && savedCategoryId !== null) {
    return (
      <View style={styles.pickerTop}>
        <SectionHeading title="Категория" />
        <View style={styles.currentRow}>
          <Chip label={single === null ? NO_CATEGORY : categories.get(single)?.label ?? '…'} selected />
          <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setChanging(true)} accessibilityLabel="Сменить категорию">
            <PencilIcon color={colors.accent} size={16} />
            <Text style={styles.changeText}>Сменить</Text>
          </TouchableOpacity>
        </View>
        <CategoryPickerModal
          visible={changing}
          title="Сменить категорию"
          selectedId={single}
          allowNone
          onPick={(id) => { setChanging(false); setSingle(id); }}
          onClose={() => setChanging(false)}
        />
      </View>
    );
  }
  if (mixed) {
    return (
      <View style={styles.pickerTop}>
        <SectionHeading title="Категории мерчанта" />
        <Text style={styles.listHint}>Какие обычно категории у «{name}»?</Text>
        <View style={styles.currentRow}>
          {list.map((id) => (
            <Chip key={id} label={categories.get(id)?.label ?? '…'} selected trailing="✕" disabled={saving} onPress={() => toggle(id)} />
          ))}
          <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setAdding(true)} accessibilityLabel="Добавить категорию">
            <Text style={styles.changeText}>＋ Добавить категорию</Text>
          </TouchableOpacity>
        </View>
        {/* several at once: the merchant's ones selected and first, a tap adds or takes one off */}
        <CategoryPickerModal
          visible={adding}
          title="Категории мерчанта"
          selectedIds={list}
          onPick={(id) => { if (id !== null) toggle(id); }}
          onClose={() => setAdding(false)}
        />
      </View>
    );
  }
  return (
    // "Без категории" among them
    <View style={styles.pickerTop}>
      <CategoryPicker title="Выберите категорию" selectedId={single} onSelect={toggle} allowNone disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerTop: { marginTop: 8 },
  listHint: { fontSize: 14, color: colors.muted, marginBottom: 10 },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
});
