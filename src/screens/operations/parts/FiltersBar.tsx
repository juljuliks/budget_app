import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FilterButton } from '@/features/operations-filters';
import { colors } from '@/shared/theme/theme';
import { GROUP_BY, GroupBy } from '../model/listData';

export type FilterSheet = 'category' | 'kind' | 'date' | 'all' | 'group';

type Props = {
  categories: number;
  kinds: number;
  dated: boolean;
  groupBy: GroupBy;
  /** a sort-out: the category is set by it */
  categoryLocked: boolean;
  /** how many filters are set */
  applied: number;
  onOpen: (sheet: FilterSheet) => void;
  onReset: () => void;
  /** under the buttons (the sort-out's banner) */
  children?: React.ReactNode;
};

/**
 * Each button opens its picker in a sheet; all the filters set apply together. Merchants are found by the text search
 * (it matches the merchant name); a merchant card still opens the list filtered by its merchant, shown as a chip.
 */
export default function FiltersBar({ categories, kinds, dated, groupBy, categoryLocked, applied, onOpen, onReset, children }: Props) {
  return (
    <>
      <View style={styles.buttons}>
        <FilterButton label="Категория" count={categories} active={categories > 0} disabled={categoryLocked} onPress={() => onOpen('category')} testID="filter-category" />
        <FilterButton label="Тип" count={kinds} active={kinds > 0} onPress={() => onOpen('kind')} testID="filter-kind" />
        <FilterButton label="Дата" active={dated} onPress={() => onOpen('date')} testID="filter-date" />
        <FilterButton label={GROUP_BY.find(([k]) => k === groupBy)![1]} active={groupBy !== 'day'} onPress={() => onOpen('group')} testID="filter-group" />
      </View>
      {children}
      {applied > 0 ? (
        // how many filters are set (tap: the list of them, each with ✕) and "Сбросить все"
        <View style={styles.appliedRow}>
          <TouchableOpacity onPress={() => onOpen('all')} hitSlop={8} accessibilityRole="button" accessibilityHint="Показать фильтры">
            <Text style={styles.appliedText}>Применено фильтров: {applied}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onReset} hitSlop={8} accessibilityRole="button">
            <Text style={styles.resetText}>Сбросить все</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // under the search field; wrap onto the next lines
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 10 },
  appliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  appliedText: { fontSize: 14, color: colors.accent },
  resetText: { fontSize: 14, color: colors.danger },
});
