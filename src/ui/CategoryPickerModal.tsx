import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  onPick: (categoryId: number | null) => void;
  onClose: () => void;
};

/** Bottom sheet with the shared CategoryPicker (gear, categories, "+ Новая категория"). */
export default function CategoryPickerModal({ visible, title, selectedId, transferFirst, allowNone, newCategory, onPick, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView>
          <CategoryPicker
            selectedId={selectedId}
            onSelect={onPick}
            allowNone={allowNone}
            transferFirst={transferFirst}
            newCategory={newCategory}
            // the gear / new category leave to other screens: close the sheet first
            onNavigateAway={onClose}
          />
        </ScrollView>
        <TouchableOpacity style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Отмена</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, paddingBottom: 24, maxHeight: '75%',
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  cancel: { marginTop: 16, alignSelf: 'center', padding: 8 },
  cancelText: { fontSize: 16, color: colors.muted },
});
