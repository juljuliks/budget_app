import React from 'react';
import { StyleSheet, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import { ActiveFilter, AllFiltersSheet, DateSheet, OptionsSheet, useTransactionFilters } from '@/features/operations-filters';
import BottomSheet from '@/shared/ui/BottomSheet';
import RadioGroup from '@/shared/ui/RadioGroup';
import { KIND_LABELS } from '@/shared/lib/format';
import { GROUP_BY, GroupBy } from '../model/listData';
import type { FilterSheet } from './FiltersBar';

type Props = {
  sheet: FilterSheet | null;
  /** the filters set (their chips) */
  active: ActiveFilter[];
  filters: ReturnType<typeof useTransactionFilters>;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  onClose: () => void;
};

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The pickers of the filter buttons: categories, kinds, dates, the grouping, and the list of the filters set. */
export default function FilterSheets({ sheet, active, filters: f, groupBy, onGroupBy, onClose }: Props) {
  return (
    <>
      <OptionsSheet
        visible={sheet === 'category'}
        title="Категории"
        options={f.categoryOptions.map((c) => ({ key: c.category, label: `${categoryLabel(c)}${c.deleted ? ' (удалена)' : ''}`, count: c.count, muted: c.deleted }))}
        selected={f.categories}
        onToggle={(k) => f.setCategories((p) => toggleIn(p, k))}
        onClear={() => f.setCategories([])}
        onClose={onClose}
      />
      <OptionsSheet
        visible={sheet === 'kind'}
        title="Тип операции"
        options={f.kindOptions.map((o) => ({ key: o.kind, label: KIND_LABELS[o.kind] ?? o.kind, count: o.count }))}
        selected={f.kinds}
        onToggle={(k) => f.setKinds((p) => toggleIn(p, k))}
        onClear={() => f.setKinds([])}
        onClose={onClose}
      />
      <DateSheet visible={sheet === 'date'} value={f.range} onChange={f.changeRange} onClose={onClose} />
      <BottomSheet visible={sheet === 'group'} onClose={onClose} title="Группировать">
        <View style={styles.groupSheet}>
          <RadioGroup options={GROUP_BY} value={groupBy} onChange={(v) => { onGroupBy(v); onClose(); }} />
        </View>
      </BottomSheet>
      <AllFiltersSheet visible={sheet === 'all'} filters={active} onReset={f.resetExtra} onClose={onClose} />
    </>
  );
}

const styles = StyleSheet.create({
  groupSheet: { paddingHorizontal: 20, paddingBottom: 24 },
});
