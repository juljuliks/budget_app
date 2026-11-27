import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { plural } from '@/shared/lib/format';
import { CategoryType, countCategoriesOfType, listCategoryTypes } from '@/db/categoryTypes';
import { removeCategoryType } from './removeType';
import { paletteShades, typePalette } from '@/domain/colors';
import { PaletteStrip } from '@/shared/ui/ColorSwatches';
import BottomSheet, { SheetFlatList } from '@/shared/ui/BottomSheet';
import { CreateButton } from '@/shared/ui/PlusButton';
import RowActions from '@/shared/ui/RowActions';
import { TypeEditModal } from '@/entities/category';
import { colors } from '@/shared/theme/theme';
import { toast, toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { font, space } from '@/shared/theme/tokens';
import Empty from '@/shared/ui/Empty';

/** Category sections ("Переводы", "Хобби", ...) in a sheet: create, edit (name and colors), delete. From the categories. */
export default function CategoryTypesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [types, setTypes] = useState<CategoryType[]>([]);
  // null = closed; { type: undefined } = create
  const [editing, setEditing] = useState<{ type?: CategoryType } | null>(null);

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch(toastFailure('load types', LOAD_FAILED));
  }, []);
  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  async function remove(t: CategoryType) {
    const n = await countCategoriesOfType(t.id);
    sheetAlert(
      `Удалить раздел «${t.name}»?`,
      n > 0
        ? `${n} ${plural(n, ['категория останется', 'категории останутся', 'категорий останутся'])} без раздела.`
        : undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await removeCategoryType(t.id);
            load();
            toast(`Раздел «${t.name}» удалён`);
          },
        },
      ],
    );
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
            <TouchableOpacity accessibilityRole="button" style={styles.flex} onPress={() => setEditing({ type: t })}>
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
              onDelete={() => {
                if (t.is_transfer)
                  sheetAlert(
                    'Системный раздел',
                    `«${t.name}» нельзя удалить: из него приложение предлагает категории для переводов. Переименовать можно.`,
                  );
                else remove(t).catch(toastFailure('count categories of type', LOAD_FAILED));
              }}
            />
          </View>
        )}
        ListEmptyComponent={<Empty>Разделов нет. Нажмите «Создать».</Empty>}
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
  content: { paddingHorizontal: space[20], paddingBottom: space[16] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
  name: { fontSize: font.input, color: colors.text },
  note: { fontSize: font.caption, color: colors.muted, marginTop: space[2] },
  palette: { flexDirection: 'row', alignItems: 'center', gap: space[8], marginTop: space[6], alignSelf: 'flex-start' },
});
