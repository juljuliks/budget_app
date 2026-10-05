import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import BottomSheet from './BottomSheet';
import CategoryPicker from './CategoryPicker';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  transferFirst?: boolean;
  /** what to do with a category created from here (see CategoryEdit params) */
  newCategory?: Omit<RootStackParamList['CategoryEdit'], 'categoryId'>;
  allowNone?: boolean;
  /** categories not offered (e.g. the one being deleted) */
  excludeIds?: number[];
  onPick: (categoryId: number | null) => void;
  onClose: () => void;
};

/** Bottom sheet with the shared CategoryPicker (categories, "+ Новая категория"). */
export default function CategoryPickerModal({ visible, title, selectedId, transferFirst, allowNone, excludeIds, newCategory, onPick, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content}>
          <CategoryPicker
            selectedId={selectedId}
            onSelect={onPick}
            allowNone={allowNone}
            transferFirst={transferFirst}
            newCategory={newCategory}
            excludeIds={excludeIds}
            showAll
            // "+ Новая категория" leaves to another screen: close the sheet first
            onNavigateAway={onClose}
          />
        </ScrollView>
        <TouchableOpacity style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Отмена</Text>
        </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '75%' },
  content: { paddingHorizontal: 16 },
  cancel: { marginTop: 16, alignSelf: 'center', padding: 8 },
  cancelText: { fontSize: 16, color: colors.muted },
});
