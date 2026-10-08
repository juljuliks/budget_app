import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Category, categoryLabel, categoryUsageCounts, isTransferCategory, listCategories } from '../db/categories';
import { getTransferTypeId } from '../db/categoryTypes';
import { onTransactionsChanged } from '../events';
import CategorySheet from './CategorySheet';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import Chip from './Chip';
import SectionHeading from './SectionHeading';
import { NO_CATEGORY } from './strings';

type Props = {
  selectedId?: number | null;
  /** several picked (a merchant of different categories): each tap reports its id, the parent toggles it */
  selectedIds?: number[];
  /** null only comes from the "Без категории" chip (allowNone) */
  onSelect: (id: number | null) => void;
  /** adds a "Без категории" chip (selected when selectedId is null) */
  allowNone?: boolean;
  title?: string;
  /** money transfers: categories of the transfer type come first; a new category gets that type */
  transferFirst?: boolean;
  /** categories not to offer (already in the plan, the one being deleted, ...) */
  excludeIds?: number[];
  disabled?: boolean;
  /** every category at once (the picker in its own sheet); otherwise the most used first, COLLAPSED of them and "Показать ещё" */
  showAll?: boolean;
  /** the selected ones first (several picked in a sheet) */
  selectedFirst?: boolean;
};

/** categories shown before "Показать ещё" when the picker sits right in a form */
const COLLAPSED = 8;

/**
 * The one category selector used wherever a category is set: title, category chips and
 * "+ Новая категория". Loads categories itself and refreshes on
 * focus / changes, so a category created or edited elsewhere shows up immediately.
 */
export default function CategoryPicker({
  selectedId, selectedIds, onSelect, allowNone = false, title = 'Категория', transferFirst = false, excludeIds, disabled, showAll = false,
  selectedFirst = false,
}: Props) {
  // "+": a new category in a sheet, picked right after it is created (as if tapped in the list)
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);
  // "Все категории": every category in a sheet over this one
  const [allOpen, setAllOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([listCategories(), getTransferTypeId(), categoryUsageCounts()])
      .then(([cats, transferType, usage]) => {
        // the most used first (a stable sort keeps the usual order among equals); for transfers the transfer-type ones go first
        const byUsage = showAll ? cats : [...cats].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
        setCategories(transferFirst
          ? [...byUsage.filter(isTransferCategory), ...byUsage.filter((c) => !isTransferCategory(c))]
          : byUsage);
        setTransferTypeId(transferType);
      })
      .catch((e) => console.error('load categories failed', e));
  }, [transferFirst, showAll]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const excluded = new Set(excludeIds ?? []);
  const isSelected = (id: number) => (selectedIds ? selectedIds.includes(id) : id === selectedId);
  const offered = categories.filter((c) => !excluded.has(c.id));
  // the order they had when the sheet opened: a tap doesn't move a chip under the finger
  const [firstIds] = useState(() => new Set(selectedIds ?? []));
  // "Без категории" chosen: that chip goes first, as a chosen category would
  const [noneFirst] = useState(() => allowNone && !selectedIds && selectedId === null);
  const available = selectedFirst ? [...offered.filter((c) => firstIds.has(c.id)), ...offered.filter((c) => !firstIds.has(c.id))] : offered;
  const collapsible = !showAll && available.length > COLLAPSED + 1;
  // collapsed: the first COLLAPSED, plus the selected one when it's further down (the choice stays visible)
  const shown = !collapsible ? available
    : available.filter((c, i) => i < COLLAPSED || isSelected(c.id));

  const noneChip = <Chip label={NO_CATEGORY} selected={selectedId === null} disabled={disabled} onPress={() => onSelect(null)} compact />;

  return (
    <View>
      {/* no gear: categories are managed only from Настройки (the gear in the tab headers) */}
      <SectionHeading title={title} />
      <View style={styles.chips}>
        {noneFirst ? noneChip : null}
        {shown.map((c) => (
          <Chip key={c.id} label={categoryLabel(c)} selected={isSelected(c.id)} disabled={disabled} onPress={() => onSelect(c.id)} compact />
        ))}
        {allowNone && !noneFirst ? noneChip : null}
        {collapsible ? (
          <Chip label="Все категории" action compact disabled={disabled} onPress={() => setAllOpen(true)} />
        ) : null}
        <Chip label="Новая категория" add compact disabled={disabled} onPress={() => setCreating(true)} />
      </View>
      {collapsible ? (
        // the whole list; one pick closes it, several (selectedIds) are toggled until it's closed
        <BottomSheet visible={allOpen} onClose={() => setAllOpen(false)} title={title} style={styles.allSheet}>
          <SheetScrollView contentContainerStyle={styles.allContent}>
            <CategoryPicker
              title="Все категории"
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={(id) => { onSelect(id); if (!selectedIds) setAllOpen(false); }}
              allowNone={allowNone}
              transferFirst={transferFirst}
              excludeIds={excludeIds}
              disabled={disabled}
              showAll
            />
          </SheetScrollView>
          {selectedIds ? <SheetActions submit={{ title: 'Готово', onPress: () => setAllOpen(false) }} style={styles.allActions} /> : null}
        </BottomSheet>
      ) : null}
      <CategorySheet
        visible={creating}
        // a new category for a transfer goes to the transfer section
        typeId={transferFirst ? transferTypeId ?? undefined : undefined}
        // the short form: section, emoji, name; the rest is on the categories page
        quick
        onClose={() => setCreating(false)}
        onSaved={(id) => { load(); onSelect(id); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  allSheet: { maxHeight: '80%' },
  allContent: { paddingHorizontal: 16 },
  allActions: { paddingHorizontal: 16 },
});
