import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  CategoryType, countCategoriesOfType, createCategoryType, deleteCategoryType, findCategoryTypeByName, listCategoryTypes, renameCategoryType,
} from '../db/categoryTypes';
import { emitTransactionsChanged } from '../events';
import { PencilIcon, TrashIcon } from './icons';
import { colors } from './theme';

/** Create, rename and delete category types ("Переводы", "Хобби", ...). */
export default function CategoryTypes() {
  const [types, setTypes] = useState<CategoryType[]>([]);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch((e) => console.error('load types failed', e));
  }, []);
  useFocusEffect(load);

  async function validName(name: string, exceptId?: number): Promise<boolean> {
    if (!name.trim()) { setError('Введите название'); return false; }
    if (await findCategoryTypeByName(name, exceptId)) { setError('Такой тип уже есть'); return false; }
    return true;
  }

  async function add() {
    if (!(await validName(newName))) return;
    await createCategoryType(newName);
    setNewName('');
    setError(null);
    load();
  }

  async function saveRename() {
    if (!editing || !(await validName(editing.name, editing.id))) return;
    await renameCategoryType(editing.id, editing.name);
    setEditing(null);
    setError(null);
    emitTransactionsChanged();
    load();
  }

  async function remove(t: CategoryType) {
    const n = await countCategoriesOfType(t.id);
    Alert.alert(
      `Удалить тип «${t.name}»?`,
      n > 0 ? `${n} категор. останутся без типа.` : undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: async () => { await deleteCategoryType(t.id); emitTransactionsChanged(); load(); } },
      ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {types.map((t) => (
        <View key={t.id} style={styles.row}>
          {editing?.id === t.id ? (
            <>
              <TextInput
                style={[styles.input, styles.flex]}
                value={editing.name}
                onChangeText={(v) => { setEditing({ id: t.id, name: v }); setError(null); }}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={saveRename}
              />
              <TouchableOpacity style={styles.action} onPress={saveRename}><Text style={styles.link}>Готово</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.flex}>
                <Text style={styles.name}>{t.name}</Text>
                {t.is_transfer ? <Text style={styles.note}>Только эти категории предлагаются для переводов</Text> : null}
              </View>
              <TouchableOpacity style={styles.action} hitSlop={8} onPress={() => setEditing({ id: t.id, name: t.name })} accessibilityLabel={`Переименовать ${t.name}`}>
                <PencilIcon color={colors.muted} />
              </TouchableOpacity>
              {/* the transfer type drives transfer suggestions, so it can be renamed but not deleted */}
              {t.is_transfer ? <View style={styles.actionPlaceholder} /> : (
                <TouchableOpacity style={styles.action} hitSlop={8} onPress={() => remove(t)} accessibilityLabel={`Удалить ${t.name}`}>
                  <TrashIcon color={colors.danger} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      ))}

      <View style={[styles.row, styles.addRow]}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={newName}
          onChangeText={(v) => { setNewName(v); setError(null); }}
          placeholder="Новый тип, например Хобби"
          placeholderTextColor={colors.muted}
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <TouchableOpacity style={styles.action} onPress={add}><Text style={styles.link}>Добавить</Text></TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  addRow: { borderBottomWidth: 0, marginTop: 8 },
  flex: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  action: { padding: 8, marginLeft: 4 },
  actionPlaceholder: { width: 36, marginLeft: 4 },
  link: { fontSize: 15, color: colors.accent },
  error: { color: colors.danger, marginTop: 8 },
});
