import React, { useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryPickerModal } from '@/entities/category';
import { MerchantCard } from '@/features/merchant-card';
import { FilterButton, OptionsSheet, SearchBar } from '@/features/operations-filters';
import { NO_CATEGORY } from '@/shared/lib/strings';
import Button from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { useMerchantBulk } from './model/useMerchantBulk';
import { MIXED, useMerchants } from './model/useMerchants';
import MerchantRowView from './parts/MerchantRowView';
import SectionBand from './parts/SectionBand';

/**
 * Merchants by their category: "Без категории" first (what needs a category), then the categories in the
 * categories' order; the most frequent merchants first. Tap opens the card; a long press selects several, to give
 * them one category or delete them.
 */
export default function MerchantsScreen() {
  const list = useMerchants();
  const { categories, catFilter, setCatFilter } = list;
  const bulk = useMerchantBulk(list.merchants, categories);
  const { selectMode, selected } = bulk;
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SearchBar value={list.query} onChange={list.setQuery} placeholder="Найти мерчанта" />
        <View style={styles.filters}>
          <FilterButton label="Категория" count={catFilter.length} active={catFilter.length > 0} onPress={() => setCatSheetOpen(true)} />
        </View>
        {selectMode ? (
          <View style={styles.selectBar}>
            <Text style={styles.selectLabel}>Выбрано: {selected.length}</Text>
            <TouchableOpacity onPress={bulk.done} hitSlop={8} accessibilityRole="button">
              <Text style={styles.cancelSelect}>Отмена</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <OptionsSheet
        visible={catSheetOpen}
        title="Категории"
        options={list.catOptions}
        selected={catFilter}
        onToggle={(k) => setCatFilter((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
        onClear={() => setCatFilter([])}
        onClose={() => setCatSheetOpen(false)}
      />
      <SectionList
        sections={list.sections}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => <SectionBand section={section} staleOpen={list.staleOpen} onToggleStale={() => list.setStaleOpen((o) => !o)} />}
        renderItem={({ item, section }) => (
          <MerchantRowView
            m={item}
            category={section.stale ? (item.mixed ? MIXED : item.category_id !== null ? categories.get(item.category_id)?.label : undefined) ?? NO_CATEGORY : null}
            selecting={selectMode}
            selected={selected.includes(item.id)}
            // a long press starts selecting (with this one); while selecting a tap toggles, otherwise opens the card
            onPress={() => {
              if (bulk.longPressed.current) { bulk.longPressed.current = false; return; }
              if (selectMode) bulk.toggle(item.id); else setCardId(item.id);
            }}
            onLongPress={selectMode ? undefined : () => bulk.start(item.id)}
            onPressIn={() => { bulk.longPressed.current = false; }}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{list.filtering ? 'Не найдено.' : 'Мерчанты появятся после первых покупок.'}</Text>}
        ListFooterComponent={<View style={styles.footer} />}
      />

      {selectMode ? (
        <View style={styles.bottomBar}>
          {selected.length === 0 ? null : (
            <View style={styles.bottomActions}>
              <Button title={`Категория (${selected.length})`} onPress={() => bulk.setPickOpen(true)} style={styles.bottomButton} />
              <Button title={`Удалить (${selected.length})`} danger onPress={bulk.confirmDelete} style={styles.bottomButton} />
            </View>
          )}
        </View>
      ) : null}

      <CategoryPickerModal
        visible={bulk.pickOpen}
        title={`Категория для мерчантов (${selected.length})`}
        onPick={bulk.pickCategory}
        onClose={() => bulk.setPickOpen(false)}
      />
      <MerchantCard merchantId={cardId} categories={categories} onClose={() => setCardId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // room under the search: the first section band doesn't stick to it
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  selectBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  selectLabel: { fontSize: 15, color: colors.text },
  cancelSelect: { fontSize: 15, color: colors.accent },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  footer: { height: 88 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  bottomActions: { flexDirection: 'row', gap: 10 },
  bottomButton: { flex: 1 },
});
