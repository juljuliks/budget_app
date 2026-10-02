import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CategoryPicker from './CategoryPicker';
import { colors } from './theme';

type Props = {
  visible: boolean;
  txIds: number[];
  /** all selected transactions are transfers: offer only transfer-type categories */
  transfersOnly: boolean;
  onPick: (categoryId: number) => void;
  onClose: () => void;
};

/** Bottom sheet: pick a category for the selected transactions. */
export default function BulkCategoryModal({ visible, txIds, transfersOnly, onPick, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Выбрано транзакций: {txIds.length}</Text>
        <ScrollView>
          <CategoryPicker
            onSelect={onPick}
            transferOnly={transfersOnly}
            // a category created from here is applied to the selection right away
            newCategory={{ txIds }}
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
    padding: 16, paddingBottom: 24, maxHeight: '70%',
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  cancel: { marginTop: 16, alignSelf: 'center', padding: 8 },
  cancelText: { fontSize: 16, color: colors.muted },
});
