import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryInfo, CategoryPickerModal } from '@/entities/category';
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
  setList: (ids: number[]) => void;
};

/** "Сменить", right of the title, as on an operation. */
function ChangeButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.changeButton} disabled={disabled} onPress={onPress} accessibilityLabel="Сменить категорию">
      <PencilIcon color={colors.accent} size={16} />
      <Text style={styles.changeText}>Сменить</Text>
    </TouchableOpacity>
  );
}

/**
 * The merchant's category: one it has — its name and "Сменить"; different ones — its list (✕ takes one off) and
 * "Добавить категорию" (the list, these checked, "Готово" is the new set); none yet — "Без категории" and "Сменить".
 * The page's "Сохранить" writes it.
 */
export default function MerchantCategories({ name, savedCategoryId, categories, mixed, single, list, saving, toggle, setSingle, setList }: Props) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(false);
  const label = single === null ? NO_CATEGORY : categories.get(single)?.label ?? '…';

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
        <CategoryPickerModal
          visible={adding}
          title="Категории мерчанта"
          selectedIds={list}
          onPick={() => undefined}
          onSeveral={setList}
          onClose={() => setAdding(false)}
        />
      </View>
    );
  }
  return (
    <View style={styles.pickerTop}>
      <SectionHeading title="Категория" right={<ChangeButton disabled={saving} onPress={() => setChanging(true)} />} />
      {savedCategoryId !== null ? <Chip label={label} selected /> : <Text style={styles.none}>{label}</Text>}
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

const styles = StyleSheet.create({
  pickerTop: { marginTop: 8 },
  listHint: { fontSize: 14, color: colors.muted, marginBottom: 10 },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  none: { fontSize: 18, color: colors.text, paddingVertical: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
});
