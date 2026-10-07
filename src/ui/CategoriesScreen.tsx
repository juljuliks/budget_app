import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { NO_SECTION } from './strings';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, isSavings, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import { listCategoryTypes } from '../db/categoryTypes';
import type { RootStackParamList } from '../navigation';
import { formStyles } from './formStyles';
import { colors } from './theme';
import { CreateButton } from './PlusButton';
import CategorySheet from './CategorySheet';
import { openCategoryTypes } from './modals';
import { onTransactionsChanged } from '../events';
import Checkbox from './Checkbox';
import MergeCategoriesSheet from './MergeCategoriesSheet';
import Button from './Button';
import { plural } from './format';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

/** All live categories grouped by type: a tap opens one, a long press picks several to merge. */
export default function CategoriesScreen({ navigation }: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [colorOf, setColorOf] = useState<Map<number, string>>(new Map());
  const [types, setTypes] = useState<string[]>([]);
  // the category sheet: an existing one by id, 'new' for "+", null = closed
  const [open, setOpenState] = useState<number | 'new' | null>(null);
  // what the sheet shows: kept while it slides away (it would turn into "Новая категория" mid-animation)
  const [shown, setShown] = useState<number | 'new'>('new');
  const setOpen = (v: number | 'new' | null) => { setOpenState(v); if (v !== null) setShown(v); };
  // picked to merge, in the order picked (the first is merged into); empty = not picking
  const [picked, setPicked] = useState<number[]>([]);
  const [merging, setMerging] = useState<number[]>([]);
  const picking = picked.length > 0;
  // "Сбережения" can't be merged
  const pick = (c: Category) => {
    if (isSavings(c)) return;
    setPicked((p) => (p.includes(c.id) ? p.filter((id) => id !== c.id) : [...p, c.id]));
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <CreateButton onPress={() => setOpen('new')} accessibilityLabel="Новая категория" />
      ),
    });
  }, [navigation]);

  const load = useCallback(() => {
    Promise.all([listCategories(), categoryColors(), listCategoryTypes()])
      .then(([c, colorMap, t]) => { setCats(c); setColorOf(colorMap); setTypes(t.map((x) => x.name)); })
      .catch((e) => console.error('load categories failed', e));
  }, []);
  useFocusEffect(load);
  // a category deleted / a section edited in a sheet over this page
  useEffect(() => onTransactionsChanged(load), [load]);

  // listCategories is ordered by type, so consecutive runs form the sections
  const sections: Array<{ title: string; data: Category[] }> = [];
  for (const c of cats) {
    const title = c.type_name ?? NO_SECTION;
    if (sections.length === 0 || sections[sections.length - 1].title !== title) sections.push({ title, data: [] });
    sections[sections.length - 1].data.push(c);
  }

  return (
    <>
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(c) => String(c.id)}
      renderSectionHeader={({ section }) => <Text style={formStyles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        // like the merchants: the row opens the category in a sheet (name, section, color, operations, deleting)
        // picking: a tap picks / unpicks
        <TouchableOpacity
          style={styles.row}
          onPress={() => (picking ? pick(item) : setOpen(item.id))}
          onLongPress={() => pick(item)}
          accessibilityRole="button"
          accessibilityState={picking ? { selected: picked.includes(item.id), disabled: isSavings(item) } : undefined}
        >
          {picking ? <View style={[styles.check, isSavings(item) && styles.off]}><Checkbox checked={picked.includes(item.id)} size={20} /></View> : null}
          <View style={[styles.dot, { backgroundColor: colorOf.get(item.id) ?? colors.border }]} />
          <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
          {picking ? null : <Text style={styles.chevron}>›</Text>}
        </TouchableOpacity>
      )}
      // the category types live one level down from here
      ListHeaderComponent={picking ? (
        // picking several (started by a long press); "Объединить" at the bottom once two are picked
        <View style={styles.toolbar}>
          <Text style={[styles.pickLabel, styles.flex]}>Выбрано: {picked.length}</Text>
          <TouchableOpacity onPress={() => setPicked([])} hitSlop={8} accessibilityRole="button">
            <Text style={styles.toolbarCancel}>Отмена</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.typesRow} onPress={openCategoryTypes} accessibilityRole="button">
          <View style={styles.flex}>
            <Text style={styles.typesTitle}>Разделы</Text>
            <Text style={styles.typesNote} numberOfLines={1}>{types.length ? types.join(', ') : 'Разделы объединяют категории и задают им цвета'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Категорий нет. Нажмите «Создать».</Text>}
    />
    <CategorySheet
      visible={open !== null}
      categoryId={typeof shown === 'number' ? shown : undefined}
      onClose={() => setOpen(null)}
      onSaved={load}
      onDeleted={load}
    />
    {picked.length > 1 ? (
      <View style={styles.bottomBar}>
        <Button title={`Объединить ${picked.length} ${plural(picked.length, ['категорию', 'категории', 'категорий'])}`} onPress={() => setMerging(picked)} />
      </View>
    ) : null}
    <MergeCategoriesSheet
      ids={merging}
      onClose={() => setMerging([])}
      onMerged={() => { setMerging([]); setPicked([]); load(); }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  typesRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  flex: { flex: 1 },
  typesTitle: { fontSize: 16, color: colors.text, fontWeight: '600' },
  typesNote: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.muted, marginLeft: 8 },
  check: { marginRight: 10 },
  off: { opacity: 0.35 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  pickLabel: { fontSize: 15, color: colors.text },
  // pinned under the list
  bottomBar: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  toolbarCancel: { fontSize: 15, color: colors.muted },
});
