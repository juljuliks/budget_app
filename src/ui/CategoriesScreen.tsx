import React, { useCallback, useLayoutEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, listCategories } from '../db/categories';
import type { RootStackParamList } from '../navigation';
import { PencilIcon, TrashIcon } from './icons';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

/** All live categories grouped by type, with edit (pencil) and delete (trash). */
export default function CategoriesScreen({ navigation }: Props) {
  const [cats, setCats] = useState<Category[]>([]);

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
    listCategories().then(setCats).catch((e) => console.error('load categories failed', e));
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
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
          <TouchableOpacity
            style={styles.action}
            hitSlop={8}
            onPress={() => navigation.navigate('CategoryEdit', { categoryId: item.id })}
            accessibilityLabel={`Изменить ${item.name}`}
          >
            <PencilIcon color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            hitSlop={8}
            onPress={() => navigation.navigate('CategoryDelete', { categoryId: item.id })}
            accessibilityLabel={`Удалить ${item.name}`}
          >
            <TrashIcon color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Категорий нет. Нажмите ＋, чтобы создать.</Text>}
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
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  name: { flex: 1, fontSize: 16, color: colors.text },
  action: { padding: 8, marginLeft: 4 },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
