import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { categoryLabel, createCategory, findCategoryByName, getCategory, updateCategory } from '../db/categories';
import { CategoryType, listCategoryTypes } from '../db/categoryTypes';
import { assignCategory, assignCategoryToMany } from '../assign';
import { addPlanItem } from '../db/plans';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import SectionHeading from './SectionHeading';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryEdit'>;

/** Create (no categoryId) or edit a category: name, emoji, optional type. */
export default function CategoryEdit({ route, navigation }: Props) {
  const { categoryId, txId, txIds, planYm, typeId: initialTypeId, returnSelection } = route.params ?? {};
  const isNew = categoryId === undefined;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [typeId, setTypeId] = useState<number | null>(initialTypeId ?? null);
  const [types, setTypes] = useState<CategoryType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Новая категория' : 'Категория' });
    if (isNew) return;
    getCategory(categoryId).then((c) => {
      if (!c) return;
      setName(c.name);
      setEmoji(c.emoji ?? '');
      setTypeId(c.type_id);
    }).catch((e) => console.error('load category failed', e));
  }, [categoryId, isNew, navigation]);

  // on focus: types may have been edited on the types screen
  useFocusEffect(useCallback(() => {
    listCategoryTypes().then((t) => {
      setTypes(t);
      // the selected type was deleted meanwhile
      setTypeId((cur) => (cur !== null && !t.some((x) => x.id === cur) ? null : cur));
    }).catch((e) => console.error('load types failed', e));
  }, []));

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Введите название'); return; }
    setSaving(true);
    try {
      if (await findCategoryByName(trimmed, typeId, categoryId)) {
        setError('Такая категория уже есть');
        setSaving(false);
        return;
      }
      let createdId: number | null = null;
      if (isNew) {
        const id = await createCategory(trimmed, emoji, typeId);
        createdId = id;
        if (txId) await assignCategory(txId, id);
        if (txIds?.length) await assignCategoryToMany(txIds, id);
        if (planYm) await addPlanItem(planYm, id);
        emitTransactionsChanged();
      } else {
        await updateCategory(categoryId, { name: trimmed, emoji, typeId });
        emitTransactionsChanged();
      }
      // created for a transaction from its detail screen: the choice is made, leave that screen too
      const { routes } = navigation.getState();
      const prev = routes[routes.length - 2];
      if (isNew && txId && prev?.name === 'TransactionDetail') navigation.pop(2);
      else if (createdId !== null && returnSelection && prev) {
        // back to the screen we came from, with the new category selected there
        navigation.navigate({ name: prev.name, params: { ...prev.params, selectCategoryId: createdId }, merge: true } as never);
      } else navigation.goBack();
    } catch (e) {
      console.error('save category failed', e);
      setError('Не удалось сохранить');
      setSaving(false);
    }
  }

  const typeOptions: Array<[number | null, string]> = [[null, 'Без типа'], ...types.map((t): [number, string] => [t.id, t.name])];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionHeading title="Тип" onSettings={() => navigation.navigate('CategoryTypes')} settingsLabel="Управление типами" />
      <View style={styles.chips}>
        {typeOptions.map(([id, label]) => (
          <TouchableOpacity key={String(id)} style={[styles.chip, typeId === id && styles.chipOn]} onPress={() => setTypeId(id)}>
            <Text style={[styles.chipText, typeId === id && styles.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
      {name.trim() ? (
        <Text style={styles.preview}>
          Будет выглядеть так: {categoryLabel({ emoji, name: name.trim(), type_name: types.find((t) => t.id === typeId)?.name })}
        </Text>
      ) : null}

      <Text style={styles.label}>Эмодзи (необязательно)</Text>
      <TextInput style={[styles.input, styles.emoji]} value={emoji} onChangeText={setEmoji} placeholder="🏋️" maxLength={8} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isNew && txId ? <Text style={styles.hint}>Категория будет назначена транзакции и запомнена для её мерчанта.</Text> : null}
      {isNew && txIds?.length ? <Text style={styles.hint}>Категория будет назначена выбранным транзакциям ({txIds.length}).</Text> : null}
      {isNew && planYm ? <Text style={styles.hint}>Категория будет добавлена в план месяца.</Text> : null}

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={save}>
        <Text style={styles.buttonText}>Сохранить</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  emoji: { width: 80, textAlign: 'center' },
  preview: { color: colors.muted, marginTop: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent },
  chipText: { fontSize: 15, color: colors.text },
  chipTextOn: { color: '#FFFFFF' },
  error: { color: colors.danger, marginTop: 8 },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  button: { marginTop: 24, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
