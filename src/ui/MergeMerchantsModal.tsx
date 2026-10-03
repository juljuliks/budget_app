import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { categoriesOfMerchants, mergeMerchants, MerchantRow } from '../db/merchants';
import { emitTransactionsChanged } from '../events';
import Button from './Button';
import Chip from './Chip';
import { formStyles } from './formStyles';
import type { CategoryInfo } from './MerchantsScreen';
import { colors } from './theme';

type Props = {
  visible: boolean;
  merchants: MerchantRow[];
  categories: Map<number, CategoryInfo>;
  onDone: () => void;
  onClose: () => void;
};

/**
 * Merging the selected merchants into one group: its name (the most frequent one's by default, or the
 * selected group's) and its one category (one of those the merchants have, or none).
 */
export default function MergeMerchantsModal({ visible, merchants, categories, onDone, onClose }: Props) {
  const [name, setName] = useState('');
  const [options, setOptions] = useState<number[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const group = merchants.find((m) => m.group);
    const top = [...merchants].sort((a, b) => b.count - a.count)[0];
    setName(group?.name ?? top?.name ?? '');
    setError(null);
    setSaving(false);
    categoriesOfMerchants(merchants.map((m) => m.id)).then((ids) => {
      setOptions(ids);
      setCategoryId(ids[0] ?? null);
    }).catch((e) => console.error('load merchant categories failed', e));
    // only when opened: the selection doesn't change while the dialog is up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function merge() {
    if (!name.trim()) { setError('Введите название группы'); return; }
    setSaving(true);
    try {
      await mergeMerchants(merchants.map((m) => m.id), name, categoryId);
      emitTransactionsChanged();
      onDone();
    } catch (e) {
      console.error('merge merchants failed', e);
      setError('Не удалось объединить');
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>Объединить в группу</Text>
          <Text style={styles.members}>{merchants.map((m) => (m.group ? `${m.name} (${m.members.join(', ')})` : m.name)).join(', ')}</Text>

          <Text style={formStyles.label}>Название группы</Text>
          <TextInput
            style={formStyles.input}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder="Например, SPAR"
            maxLength={40}
          />

          <Text style={formStyles.label}>Категория группы</Text>
          <View style={styles.chips}>
            {options.map((id) => (
              <Chip key={id} label={categories.get(id)?.label ?? '?'} selected={categoryId === id} onPress={() => setCategoryId(id)} />
            ))}
            <Chip label="Без категории" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          </View>
          <Text style={formStyles.hint}>
            У группы одна категория: её получают новые транзакции всех мерчантов группы и их транзакции с автоматической
            категорией. Выбранные вручную категории не меняются.
          </Text>

          {error ? <Text style={formStyles.error}>{error}</Text> : null}
          <Button title="Объединить" onPress={merge} disabled={saving} style={styles.button} />
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '85%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  members: { fontSize: 14, color: colors.muted, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { marginTop: 20 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 16, color: colors.muted },
});
