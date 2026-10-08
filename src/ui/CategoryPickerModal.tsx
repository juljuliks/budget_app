import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SheetActions } from './Button';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import CategoryPicker from './CategoryPicker';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  /** several picked: each tap reports its id (the parent toggles it), the sheet stays open until "Готово" */
  selectedIds?: number[];
  transferFirst?: boolean;
  allowNone?: boolean;
  /** categories not offered (e.g. the one being deleted) */
  excludeIds?: number[];
  onPick: (categoryId: number | null) => void;
  onClose: () => void;
};

/** Bottom sheet with the shared CategoryPicker (categories, "+ Новая категория"). */
export default function CategoryPickerModal({ visible, title, selectedId, selectedIds, transferFirst, allowNone, excludeIds, onPick, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={styles.sheet}>
        <SheetScrollView contentContainerStyle={styles.content}>
          {/* remounted on opening: the selected ones go first in the order of that moment */}
          {visible ? <CategoryPicker
            selectedId={selectedId}
            selectedIds={selectedIds}
            selectedFirst={!!selectedIds}
            onSelect={onPick}
            allowNone={allowNone}
            transferFirst={transferFirst}
            excludeIds={excludeIds}
            showAll
          /> : null}
        </SheetScrollView>
        {selectedIds
          ? <SheetActions submit={{ title: 'Готово', onPress: onClose }} style={styles.actions} />
          : <SheetActions submit={null} onCancel={onClose} style={styles.actions} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '75%' },
  content: { paddingHorizontal: 16 },
  actions: { paddingHorizontal: 16 },
});
