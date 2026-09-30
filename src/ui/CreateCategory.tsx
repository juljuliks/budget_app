import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createCategory, findCategoryByName } from '../db/categories';
import { assignCategory } from '../assign';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCategory'>;

export default function CreateCategory({ route, navigation }: Props) {
  const txId = route.params?.txId;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Введите название'); return; }
    setSaving(true);
    try {
      if (await findCategoryByName(trimmed)) {
        setError('Категория с таким названием уже есть');
        setSaving(false);
        return;
      }
      const id = await createCategory(trimmed, emoji.trim() || undefined);
      if (txId) await assignCategory(txId, id);
      // opened from a transaction's detail screen: skip it too, the choice is made
      const { routes } = navigation.getState();
      const prev = routes[routes.length - 2];
      if (txId && prev?.name === 'TransactionDetail') navigation.pop(2);
      else navigation.goBack();
    } catch (e) {
      console.error('create category failed', e);
      setError('Не удалось сохранить');
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(v) => { setName(v); setError(null); }}
        placeholder="Например, Спорт"
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Text style={styles.label}>Эмодзи (необязательно)</Text>
      <TextInput style={[styles.input, styles.emoji]} value={emoji} onChangeText={setEmoji} placeholder="🏋️" maxLength={8} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {txId ? <Text style={styles.hint}>Категория будет назначена транзакции и запомнена для её мерчанта.</Text> : null}
      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={save}>
        <Text style={styles.buttonText}>Сохранить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: colors.bg },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  emoji: { width: 80, textAlign: 'center' },
  error: { color: '#B91C1C', marginTop: 8 },
  hint: { color: colors.muted, marginTop: 12, fontSize: 13 },
  button: { marginTop: 24, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
