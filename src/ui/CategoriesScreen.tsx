import React, { useCallback, useLayoutEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, listCategories } from '../db/categories';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

export default function CategoriesScreen({ navigation }: Props) {
  const [cats, setCats] = useState<Category[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('CategoryEdit', {})} hitSlop={12}>
          <Text style={styles.headerAction}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    listCategories(10_000, { includeArchived: true }).then(setCats).catch((e) => console.error('load categories failed', e));
  }, []));

  const sections = [
    { title: 'Активные', data: cats.filter((c) => !c.is_archived) },
    { title: 'Архив', data: cats.filter((c) => c.is_archived) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(c) => String(c.id)}
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('CategoryEdit', { categoryId: item.id })}>
          <Text style={[styles.name, item.is_archived ? styles.archived : null]}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  headerAction: { fontSize: 24, color: colors.accent },
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    color: colors.muted, fontSize: 13, fontWeight: '600',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  name: { flex: 1, fontSize: 16, color: colors.text },
  archived: { color: colors.muted },
  chevron: { fontSize: 20, color: colors.muted },
});
