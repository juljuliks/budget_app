import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Category, categoryLabel, listCategories } from '../db/categories';
import { colors } from './theme';

type Props = {
  visible: boolean;
  count: number;
  /** all selected transactions are transfers: offer only transfer-type categories */
  transfersOnly: boolean;
  onPick: (categoryId: number) => void;
  onClose: () => void;
};

/** Bottom sheet: pick an existing category for the selected transactions. */
export default function BulkCategoryModal({ visible, count, transfersOnly, onPick, onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!visible) return;
    listCategories({ transferOnly: transfersOnly }).then(setCategories).catch((e) => console.error('load categories failed', e));
  }, [visible, transfersOnly]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Категория для {count} транзакц.</Text>
        <ScrollView contentContainerStyle={styles.chips}>
          {categories.map((c) => (
            <TouchableOpacity key={c.id} style={styles.chip} onPress={() => onPick(c.id)}>
              <Text style={styles.chipText}>{categoryLabel(c)}</Text>
            </TouchableOpacity>
          ))}
          {categories.length === 0 ? <Text style={styles.hint}>Нет подходящих категорий.</Text> : null}
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
  title: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
  chipText: { fontSize: 15, color: colors.text },
  hint: { color: colors.muted, fontSize: 14 },
  cancel: { marginTop: 16, alignSelf: 'center', padding: 8 },
  cancelText: { fontSize: 16, color: colors.muted },
});
