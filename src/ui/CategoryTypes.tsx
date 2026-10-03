import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CategoryType, countCategoriesOfType, setCategoryTypePalette, createCategoryType, deleteCategoryType, findCategoryTypeByName, listCategoryTypes, renameCategoryType,
} from '../db/categoryTypes';
import { emitTransactionsChanged } from '../events';
import { returnToPrevious, RootStackParamList } from '../navigation';
import { freePalettes, PaletteKey, PALETTES, typePalette } from '../colors';
import { PaletteStrip } from './ColorSwatches';
import Fab from './Fab';
import RowActions from './RowActions';
import TextInputModal from './TextInputModal';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryTypes'>;

/** Create, rename and delete category types ("Переводы", "Хобби", ...). */
export default function CategoryTypes({ route, navigation }: Props) {
  const [types, setTypes] = useState<CategoryType[]>([]);
  // null = closed; { id: undefined } = create
  const [dialog, setDialog] = useState<{ id?: number; name: string } | null>(null);
  const [paletteFor, setPaletteFor] = useState<CategoryType | null>(null);

  async function choosePalette(palette: PaletteKey) {
    if (!paletteFor) return;
    await setCategoryTypePalette(paletteFor.id, palette);
    setPaletteFor(null);
    emitTransactionsChanged();
    load();
  }

  const load = useCallback(() => {
    listCategoryTypes().then(setTypes).catch((e) => console.error('load types failed', e));
  }, []);
  useFocusEffect(load);

  async function save(name: string): Promise<string | null> {
    if (await findCategoryTypeByName(name, dialog?.id)) return 'Такой тип уже есть';
    if (dialog?.id === undefined) {
      const id = await createCategoryType(name);
      emitTransactionsChanged();
      // opened from the category editor: back there with the new type selected
      if (route.params?.returnSelection) {
        setDialog(null);
        returnToPrevious(navigation, { selectTypeId: id });
        return null;
      }
    } else {
      await renameCategoryType(dialog.id, name);
      emitTransactionsChanged();
    }
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
        renderItem={({ item: t, index }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{t.name}</Text>
              {t.is_transfer ? <Text style={styles.note}>Эти категории предлагаются для переводов</Text> : null}
              {/* the type's color family: its categories take these shades */}
              <TouchableOpacity style={styles.palette} onPress={() => setPaletteFor(t)} hitSlop={6} accessibilityLabel={`Цвета типа ${t.name}`}>
                <PaletteStrip shades={PALETTES[typePalette(t, index)].shades} />
                <Text style={styles.paletteLink}>Сменить цвета</Text>
              </TouchableOpacity>
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
      <Modal visible={paletteFor !== null} transparent animationType="fade" onRequestClose={() => setPaletteFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPaletteFor(null)}>
          {/* taps inside the dialog must not reach the backdrop (which closes it) */}
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>Цвета «{paletteFor?.name}»</Text>
            {/* palettes other types use are not offered */}
            {(paletteFor ? freePalettes(types, paletteFor.id) : []).map((k) => (
              <TouchableOpacity key={k} style={styles.paletteOption} onPress={() => choosePalette(k)}>
                <PaletteStrip shades={PALETTES[k].shades} size={20} />
                <Text style={[styles.paletteName, paletteFor?.palette === k && styles.paletteChosen]}>{PALETTES[k].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  palette: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, alignSelf: 'flex-start' },
  paletteLink: { fontSize: 13, color: colors.accent },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.bg, borderRadius: 12, padding: 20 },
  dialogTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
  paletteOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  paletteName: { fontSize: 15, color: colors.text },
  paletteChosen: { fontWeight: '700' },
});
