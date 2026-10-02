import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  CategoryType, countCategoriesOfType, createCategoryType, deleteCategoryType, findCategoryTypeByName, listCategoryTypes, renameCategoryType,
} from '../db/categoryTypes';
import { emitTransactionsChanged } from '../events';
import Fab from './Fab';
import RowActions from './RowActions';
import TextInputModal from './TextInputModal';
import { colors } from './theme';

/** Create, rename and delete category types ("Переводы", "Хобби", ...). */
export default function CategoryTypes() {
  const [types, setTypes] = useState<CategoryType[]>([]);
  // null = closed; { id: undefined } = create
  const [dialog, setDialog] = useState<{ id?: number; name: string } | null>(null);

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch((e) => console.error('load types failed', e));
  }, []);
  useFocusEffect(load);

  async function save(name: string): Promise<string | null> {
    if (await findCategoryTypeByName(name, dialog?.id)) return 'Такой тип уже есть';
    if (dialog?.id === undefined) await createCategoryType(name);
    else await renameCategoryType(dialog.id, name);
    emitTransactionsChanged();
    load();
    return null;
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
    <View style={styles.screen}>
      <FlatList
        data={types}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.content}
        renderItem={({ item: t }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{t.name}</Text>
              {t.is_transfer ? <Text style={styles.note}>Эти категории предлагаются для переводов</Text> : null}
            </View>
            {/* the transfer type drives transfer suggestions: grey trash that explains instead of deleting */}
            <RowActions
              subject={t.name}
              onEdit={() => setDialog({ id: t.id, name: t.name })}
              deleteDisabled={!!t.is_transfer}
              onDelete={() => (t.is_transfer
                ? Alert.alert('Системный тип', `«${t.name}» нельзя удалить: по нему приложение выбирает категории для переводов. Переименовать можно.`)
                : remove(t))}
            />
          </View>
        )}
      />
      {/* pinned to the bottom like the "+" on the transactions screen */}
      <Fab onPress={() => setDialog({ name: '' })} accessibilityLabel="Новый тип" />
      <TextInputModal
        visible={dialog !== null}
        title={dialog?.id === undefined ? 'Новый тип' : 'Переименовать тип'}
        initialValue={dialog?.name ?? ''}
        placeholder="Например, Хобби"
        submitLabel={dialog?.id === undefined ? 'Создать' : 'Сохранить'}
        onSubmit={save}
        onClose={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 96 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  flex: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
