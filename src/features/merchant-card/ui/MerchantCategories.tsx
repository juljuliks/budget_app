import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryInfo, CategoryPickerModal } from '@/entities/category';
import Chip from '@/shared/ui/Chip';
import SectionHeading from '@/shared/ui/SectionHeading';
import { PencilIcon } from '@/shared/ui/icons';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';

type Props = {
  categories: Map<number, CategoryInfo>;
  mixed: boolean;
  single: number | null;
  list: number[];
  saving: boolean;
  chooseOne: (id: number | null) => void;
  chooseSeveral: (ids: number[]) => void;
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
 * The merchant's category, as on an operation: the one it has, "Без категории", or several chips. "Сменить" opens the
 * category list; a long press there picks several ("Готово" is the set). The page's "Сохранить" writes it.
 */
export default function MerchantCategories({ categories, mixed, single, list, saving, chooseOne, chooseSeveral }: Props) {
  const [changing, setChanging] = useState(false);
  const label = (id: number) => categories.get(id)?.label ?? '…';
  const close = () => setChanging(false);

  return (
    <View style={styles.pickerTop}>
      <SectionHeading title="Категория" right={<ChangeButton disabled={saving} onPress={() => setChanging(true)} />} />
      {mixed && list.length ? (
        <View style={styles.currentRow}>
          {list.map((id) => <Chip key={id} label={label(id)} selected />)}
        </View>
      ) : single !== null ? (
        <View style={styles.currentRow}>
          <Chip label={label(single)} selected />
        </View>
      ) : (
        <Text style={styles.none}>{NO_CATEGORY}</Text>
      )}
      <CategoryPickerModal
        visible={changing}
        title="Сменить категорию"
        selectedId={mixed ? null : single}
        allowNone
        onPick={(id) => { chooseOne(id); close(); }}
        onSeveral={(ids) => { chooseSeveral(ids); close(); }}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerTop: { marginTop: 8 },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  none: { fontSize: 18, color: colors.text, paddingVertical: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
});
