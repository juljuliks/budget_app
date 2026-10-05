import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Category, categoryLabel, isTransferCategory, listCategories } from '../db/categories';
import { getTransferTypeId } from '../db/categoryTypes';
import { onTransactionsChanged } from '../events';
import CategorySheet from './CategorySheet';
import Chip from './Chip';
import SectionHeading from './SectionHeading';

type Props = {
  selectedId?: number | null;
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
};

/**
 * The one category selector used wherever a category is set: title, category chips and
 * "+ Новая категория". Loads categories itself and refreshes on
 * focus / changes, so a category created or edited elsewhere shows up immediately.
 */
export default function CategoryPicker({
  selectedId, onSelect, allowNone = false, title = 'Категория', transferFirst = false, excludeIds, disabled,
}: Props) {
  // "+": a new category in a sheet, picked right after it is created (as if tapped in the list)
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([listCategories(), getTransferTypeId()])
      .then(([cats, transferType]) => {
        // always all categories; for transfers the transfer-type ones go first
        setCategories(transferFirst
          ? [...cats.filter(isTransferCategory), ...cats.filter((c) => !isTransferCategory(c))]
          : cats);
        setTransferTypeId(transferType);
      })
      .catch((e) => console.error('load categories failed', e));
  }, [transferFirst]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const excluded = new Set(excludeIds ?? []);
  const shown = categories.filter((c) => !excluded.has(c.id));

  return (
    <View>
      {/* no gear: categories are managed only from Настройки (the gear in the tab headers) */}
      <SectionHeading title={title} />
      <View style={styles.chips}>
        {shown.map((c) => (
          <Chip key={c.id} label={categoryLabel(c)} selected={c.id === selectedId} disabled={disabled} onPress={() => onSelect(c.id)} compact />
        ))}
        {allowNone ? (
          <Chip label="Без категории" selected={selectedId === null} disabled={disabled} onPress={() => onSelect(null)} compact />
        ) : null}
        <Chip label="Новая категория" add compact disabled={disabled} onPress={() => setCreating(true)} />
      </View>
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
});
