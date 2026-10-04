import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CategoryType, countCategoriesOfType, deleteCategoryType, listCategoryTypes } from '../db/categoryTypes';
import { emitTransactionsChanged } from '../events';
import { paletteShades, typePalette } from '../colors';
import { PaletteStrip } from './ColorSwatches';
import Fab from './Fab';
import RowActions from './RowActions';
import TypeEditModal from './TypeEditModal';
import { colors } from './theme';

/** Category types ("Переводы", "Хобби", ...): create, edit (name and colors), delete. Opened from the settings. */
export default function CategoryTypes() {
  const [types, setTypes] = useState<CategoryType[]>([]);
  // null = closed; { type: undefined } = create
  const [editing, setEditing] = useState<{ type?: CategoryType } | null>(null);

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch((e) => console.error('load types failed', e));
  }, []);
  useFocusEffect(load);

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
        renderItem={({ item: t, index }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.flex} onPress={() => setEditing({ type: t })}>
              <Text style={styles.name}>{t.name}</Text>
              {t.is_transfer ? <Text style={styles.note}>Эти категории предлагаются для переводов</Text> : null}
              {/* the type's color family: its categories take these shades */}
              <View style={styles.palette}>
                <PaletteStrip shades={paletteShades(typePalette(t, index))} />
              </View>
            </TouchableOpacity>
            {/* the transfer type drives transfer suggestions: grey trash that explains instead of deleting */}
            <RowActions
              subject={t.name}
              onEdit={() => setEditing({ type: t })}
              deleteDisabled={!!t.is_transfer}
              onDelete={() => (t.is_transfer
                ? Alert.alert('Системный тип', `«${t.name}» нельзя удалить: по нему приложение выбирает категории для переводов. Переименовать можно.`)
                : remove(t))}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Типов нет. Нажмите ＋, чтобы создать.</Text>}
      />
      {/* pinned to the bottom like the "+" on the transactions screen */}
      <Fab onPress={() => setEditing({})} accessibilityLabel="Новый тип" />
      <TypeEditModal
        visible={editing !== null}
        type={editing?.type}
        types={types}
        onClose={() => setEditing(null)}
        onSaved={load}
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
  palette: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, alignSelf: 'flex-start' },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
