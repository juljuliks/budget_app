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
  transferFirst?: boolean;
  allowNone?: boolean;
  /** categories not offered (e.g. the one being deleted) */
  excludeIds?: number[];
  onPick: (categoryId: number | null) => void;
  onClose: () => void;
};

/** Bottom sheet with the shared CategoryPicker (categories, "+ Новая категория"). */
export default function CategoryPickerModal({ visible, title, selectedId, transferFirst, allowNone, excludeIds, onPick, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={styles.sheet}>
        <SheetScrollView contentContainerStyle={styles.content}>
          <CategoryPicker
            selectedId={selectedId}
            onSelect={onPick}
            allowNone={allowNone}
            transferFirst={transferFirst}
            excludeIds={excludeIds}
            showAll
          />
        </SheetScrollView>
        <SheetActions submit={null} onCancel={onClose} style={styles.actions} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '75%' },
  content: { paddingHorizontal: 16 },
  actions: { paddingHorizontal: 16 },
});
