import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  countTransactionsInCategory, createCategory, deleteCategory, findCategoryByName, getCategory,
  setCategoryArchived, updateCategory,
} from '../db/categories';
import { assignCategory } from '../assign';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryEdit'>;

/** Create (no categoryId) or edit a category. */
export default function CategoryEdit({ route, navigation }: Props) {
  const { categoryId, txId } = route.params ?? {};
  const isNew = categoryId === undefined;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Новая категория' : 'Категория' });
    if (isNew) return;
    getCategory(categoryId).then((c) => {
      if (!c) return;
      setName(c.name);
      setEmoji(c.emoji ?? '');
      setArchived(c.is_archived === 1);
    }).catch((e) => console.error('load category failed', e));
  }, [categoryId, isNew, navigation]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Введите название'); return; }
    setSaving(true);
    try {
      if (await findCategoryByName(trimmed, categoryId)) {
        setError('Категория с таким названием уже есть');
        setSaving(false);
        return;
      }
      if (isNew) {
        const id = await createCategory(trimmed, emoji);
        if (txId) await assignCategory(txId, id);
      } else {
        await updateCategory(categoryId, { name: trimmed, emoji });
        emitTransactionsChanged();
      }
      // created for a transaction from its detail screen: the choice is made, leave that screen too
      const { routes } = navigation.getState();
      const prev = routes[routes.length - 2];
      if (isNew && txId && prev?.name === 'TransactionDetail') navigation.pop(2);
      else navigation.goBack();
    } catch (e) {
      console.error('save category failed', e);
      setError('Не удалось сохранить');
      setSaving(false);
    }
  }

  async function toggleArchive() {
    await setCategoryArchived(categoryId!, !archived);
    emitTransactionsChanged();
    navigation.goBack();
  }

  async function confirmDelete() {
    const n = await countTransactionsInCategory(categoryId!);
    Alert.alert(
      `Удалить «${name}»?`,
      n > 0
        ? `${n} транзакц. останутся без категории, правила для мерчантов и план будут удалены. Чтобы сохранить историю, лучше архивировать.`
        : 'Правила для мерчантов и план тоже будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive', onPress: async () => {
            await deleteCategory(categoryId!);
            emitTransactionsChanged();
            navigation.goBack();
          },
        },
      ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(v) => { setName(v); setError(null); }}
        placeholder="Например, Спорт"
        autoFocus={isNew}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Text style={styles.label}>Эмодзи (необязательно)</Text>
      <TextInput style={[styles.input, styles.emoji]} value={emoji} onChangeText={setEmoji} placeholder="🏋️" maxLength={8} />
      <Text style={styles.hint}>Название, начинающееся со слова «Перевод», делает категорию доступной для переводов.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isNew && txId ? <Text style={styles.hint}>Категория будет назначена транзакции и запомнена для её мерчанта.</Text> : null}

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={save}>
        <Text style={styles.buttonText}>Сохранить</Text>
      </TouchableOpacity>

      {!isNew ? (
        <>
          <TouchableOpacity style={styles.secondary} onPress={toggleArchive}>
            <Text style={styles.secondaryText}>{archived ? 'Вернуть из архива' : 'В архив'}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Архивная категория скрыта из выбора, но её транзакции и статистика сохраняются.</Text>
          <TouchableOpacity style={styles.secondary} onPress={confirmDelete}>
            <Text style={[styles.secondaryText, styles.danger]}>Удалить категорию</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12, marginBottom: 6 },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  emoji: { width: 80, textAlign: 'center' },
  error: { color: colors.danger, marginTop: 8 },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  button: { marginTop: 24, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondary: { marginTop: 20, alignSelf: 'flex-start' },
  secondaryText: { fontSize: 16, color: colors.accent },
  danger: { color: colors.danger },
});
