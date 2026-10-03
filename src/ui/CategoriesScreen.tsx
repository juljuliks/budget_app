import React, { useCallback, useLayoutEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import type { RootStackParamList } from '../navigation';
import { formStyles } from './formStyles';
import RowActions from './RowActions';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

/** All live categories grouped by type, with edit (pencil) and delete (trash). */
export default function CategoriesScreen({ navigation }: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [colorOf, setColorOf] = useState<Map<number, string>>(new Map());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('CategoryEdit', {})} hitSlop={12} accessibilityLabel="Новая категория">
          <Text style={styles.headerAction}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    Promise.all([listCategories(), categoryColors()])
      .then(([c, colorMap]) => { setCats(c); setColorOf(colorMap); })
      .catch((e) => console.error('load categories failed', e));
  }, []));

  // listCategories is ordered by type, so consecutive runs form the sections
  const sections: Array<{ title: string; data: Category[] }> = [];
  for (const c of cats) {
    const title = c.type_name ?? 'Без типа';
    if (sections.length === 0 || sections[sections.length - 1].title !== title) sections.push({ title, data: [] });
    sections[sections.length - 1].data.push(c);
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(c) => String(c.id)}
      renderSectionHeader={({ section }) => <Text style={formStyles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colorOf.get(item.id) ?? colors.border }]} />
          <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
          <RowActions
            subject={item.name}
            onEdit={() => navigation.navigate('CategoryEdit', { categoryId: item.id })}
            onDelete={() => navigation.navigate('CategoryDelete', { categoryId: item.id })}
          />
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Категорий нет. Нажмите ＋, чтобы создать.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  headerAction: { fontSize: 24, color: colors.accent },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
