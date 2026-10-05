import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sheetAlert } from './sheetAlert';
import { plural } from './format';
import { CategoryType, countCategoriesOfType, deleteCategoryType, listCategoryTypes } from '../db/categoryTypes';
import { emitTransactionsChanged } from '../events';
import { paletteShades, typePalette } from '../colors';
import { PaletteStrip } from './ColorSwatches';
import BottomSheet, { SheetFlatList } from './BottomSheet';
import { CreateButton } from './PlusButton';
import RowActions from './RowActions';
import TypeEditModal from './TypeEditModal';
import { colors } from './theme';

/** Category sections ("Переводы", "Хобби", ...) in a sheet: create, edit (name and colors), delete. From the categories. */
export default function CategoryTypesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [types, setTypes] = useState<CategoryType[]>([]);
  // null = closed; { type: undefined } = create
  const [editing, setEditing] = useState<{ type?: CategoryType } | null>(null);

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch((e) => console.error('load types failed', e));
  }, []);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  async function remove(t: CategoryType) {
    const n = await countCategoriesOfType(t.id);
    sheetAlert(
      `Удалить раздел «${t.name}»?`,
      n > 0 ? `${n} ${plural(n, ['категория останется', 'категории останутся', 'категорий останутся'])} без раздела.` : undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: async () => { await deleteCategoryType(t.id); emitTransactionsChanged(); load(); } },
      ]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Разделы" style={styles.sheet}>
      <View style={styles.top}>
        <CreateButton onPress={() => setEditing({})} accessibilityLabel="Новый раздел" />
      </View>
      <SheetFlatList
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
                ? sheetAlert('Системный раздел', `«${t.name}» нельзя удалить: из него приложение предлагает категории для переводов. Переименовать можно.`)
                : remove(t))}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Разделов нет. Нажмите «Создать».</Text>}
      />
      <TypeEditModal
        visible={editing !== null}
        type={editing?.type}
        types={types}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  // "+ Создать" at the top right, under the title
  top: { position: 'absolute', top: 14, right: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
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
