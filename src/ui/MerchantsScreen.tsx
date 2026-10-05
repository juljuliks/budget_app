import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import { deleteMerchants, listMerchants, MerchantActivity, MerchantRow } from '../db/merchants';
import { normalizeForSearch } from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import Button from './Button';
import Checkbox from './Checkbox';
import { plural } from './format';
import { SearchIcon } from './icons';
import MerchantCard from './MerchantCard';
import { formatMoneyWithCurrency } from './money';
import { sheetAlert } from './sheetAlert';
import MergeMerchantsModal from './MergeMerchantsModal';
import { colors } from './theme';
import { toast, toastError } from './toast';

export type CategoryInfo = { label: string; color: string };

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** "12 мая", with the year when it isn't this one: "12 мая 2025". */
function shortDate(unix: number, now = new Date()): string {
  const d = new Date(unix * 1000);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/**
 * "За последний месяц: 3 покупки на 45.20 ₾", or without any then, all of them with their dates:
 * "5 покупок на 120 ₾ · 12 мая – 20 авг".
 */
function activityText(a: MerchantActivity): string {
  if (a.count === 0) return 'Покупок нет';
  const what = `${a.count} ${plural(a.count, ['покупка', 'покупки', 'покупок'])} на ${a.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}`;
  if (a.recent) return `За последний месяц: ${what}`;
  const from = shortDate(a.from), to = shortDate(a.to);
  return `${what} · ${from === to ? from : `${from} – ${to}`}`;
}

/** Merchants (and groups) with their categories; tap opens the card, "Выбрать несколько" merges into a group. */
export default function MerchantsScreen() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([listMerchants(), listCategories(), categoryColors()]).then(([m, cats, colorOf]) => {
      setMerchants(m);
      setCategories(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }])));
    }).catch((e) => console.error('load merchants failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const words = normalizeForSearch(query);
  const shown = useMemo(() => (words
    ? merchants.filter((m) => normalizeForSearch([m.name, ...m.members].join(' ')).includes(words))
    : merchants), [merchants, words]);

  function toggleSelectMode() {
    setSelectMode((on) => !on);
    setSelected([]);
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // a merchant: its operations stay with their categories, without the merchant; a group is only ungrouped
  function confirmDelete() {
    const picked = merchants.filter((m) => selected.includes(m.id));
    const singles = picked.filter((m) => !m.group);
    const groups = picked.filter((m) => m.group);
    const n = singles.reduce((a, m) => a + m.count, 0);
    const onlyGroups = singles.length === 0;
    const ungroup = groups.length === 1 ? `разгруппировать «${groups[0].name}»` : `разгруппировать группы (${groups.length})`;
    const remove = singles.length === 1 ? `удалить мерчанта «${singles[0].name}»` : `удалить мерчантов (${singles.length})`;
    const sentence = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}?`;
    const title = sentence(onlyGroups ? ungroup : groups.length ? `${remove} и ${ungroup}` : remove);
    const parts: string[] = [];
    if (singles.length) {
      parts.push(`${n} ${plural(n, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
        + `Новые операции ${singles.length === 1 ? 'этого мерчанта' : 'этих мерчантов'} не будут получать категорию автоматически. `
        + `Новые SMS от ${singles.length === 1 ? 'него снова создадут мерчанта' : 'них снова создадут мерчантов'}.`);
    }
    for (const g of groups) {
      parts.push(`Группа «${g.name}» не удаляется, а распадается: ${g.members.join(', ')} станут отдельными мерчантами с её категорией. Операции не изменятся.`);
    }
    sheetAlert(title, parts.join('\n\n'), [
      { text: 'Отмена', style: 'cancel' },
      {
        text: onlyGroups ? 'Разгруппировать' : groups.length ? 'Удалить и разгруппировать' : singles.length === 1 ? 'Удалить мерчанта' : `Удалить (${singles.length})`,
        style: 'destructive',
        onPress: () => {
          deleteMerchants(picked.map((m) => m.id)).then(() => {
            setSelectMode(false);
            setSelected([]);
            emitTransactionsChanged();
            toast(onlyGroups ? (groups.length === 1 ? `Группа «${groups[0].name}» разгруппирована` : 'Группы разгруппированы')
              : picked.length === 1 ? `Мерчант «${picked[0].name}» удалён`
              : groups.length ? 'Мерчанты удалены, группы разгруппированы' : `Удалено мерчантов: ${singles.length}`);
          }).catch((e) => { console.error('delete merchants failed', e); toastError('Не удалось удалить'); });
        },
      },
    ]);
  }

  function merged() {
    setMergeOpen(false);
    setSelectMode(false);
    setSelected([]);
    load();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.search}>
          <SearchIcon color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Найти мерчанта"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Очистить">
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectMode} accessibilityRole="checkbox" accessibilityState={{ checked: selectMode }}>
          <Checkbox checked={selectMode} size={20} />
          <Text style={styles.selectLabel}>Выбрать несколько</Text>
          {selectMode && selected.length > 0 ? <Text style={styles.selectCount}>({selected.length})</Text> : null}
        </TouchableOpacity>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const cat = item.category_id !== null ? categories.get(item.category_id) : undefined;
          const on = selected.includes(item.id);
          return (
            <TouchableOpacity style={styles.row} onPress={() => (selectMode ? toggle(item.id) : setCardId(item.id))}>
              {selectMode ? <Checkbox checked={on} size={20} /> : null}
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {item.group ? <Text style={styles.groupTag}>группа</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={2}>
                  {item.group ? `${item.members.join(', ')} · ` : ''}{activityText(item.activity)}
                </Text>
              </View>
              {cat ? (
                <View style={styles.category}>
                  <View style={[styles.dot, { backgroundColor: cat.color }]} />
                  <Text style={styles.categoryText} numberOfLines={1}>{cat.label}</Text>
                </View>
              ) : (
                <Text style={styles.noCategory}>Без категории</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{query ? 'Не найдено.' : 'Мерчанты появятся после первых покупок.'}</Text>}
        ListFooterComponent={<View style={styles.footer} />}
      />

      {selectMode ? (
        <View style={styles.bottomBar}>
          {selected.length === 0 ? (
            <Text style={styles.bottomHint}>Выберите мерчантов, чтобы удалить их, или двух и больше, чтобы объединить в группу.</Text>
          ) : (
            <View style={styles.bottomActions}>
              <Button
                title={selected.length >= 2 ? `Объединить (${selected.length})` : 'Объединить'}
                disabled={selected.length < 2}
                onPress={() => setMergeOpen(true)}
                style={styles.bottomButton}
              />
              <Button title={`Удалить (${selected.length})`} danger onPress={confirmDelete} style={styles.bottomButton} />
            </View>
          )}
        </View>
      ) : null}

      <MergeMerchantsModal
        visible={mergeOpen}
        merchants={merchants.filter((m) => selected.includes(m.id))}
        categories={categories}
        onDone={merged}
        onClose={() => setMergeOpen(false)}
      />
      <MerchantCard merchantId={cardId} categories={categories} onClose={() => setCardId(null)} onChanged={load} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
  selectToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  selectLabel: { fontSize: 15, color: colors.text },
  selectCount: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowMain: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, color: colors.text, flexShrink: 1 },
  groupTag: { fontSize: 11, color: colors.accent, borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 6 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  categoryText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  noCategory: { fontSize: 13, color: colors.muted },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  footer: { height: 88 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  bottomActions: { flexDirection: 'row', gap: 10 },
  bottomButton: { flex: 1 },
  bottomHint: { fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
});
