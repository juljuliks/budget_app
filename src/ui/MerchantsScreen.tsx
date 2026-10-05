import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel, categoryLabelOf, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import { deleteMerchants, listMerchants, MerchantActivity, merchantsCategoryPreview, MerchantRow, setMerchantsCategory } from '../db/merchants';
import { normalizeForSearch } from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import Button from './Button';
import Checkbox from './Checkbox';
import { plural } from './format';
import { SearchIcon } from './icons';
import MerchantCard from './MerchantCard';
import { formatMoneyWithCurrency } from './money';
import { sheetAlert } from './sheetAlert';
import CategoryPickerModal from './CategoryPickerModal';
import { formStyles } from './formStyles';
import { NO_CATEGORY } from './strings';
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

/** `count`: the section's merchants (a collapsed one shows none of them); `stale`: the "давно не было покупок" one */
type Section = { key: string; title: string; count: number; stale?: boolean; data: MerchantRow[] };

/**
 * Merchants by their category: "Без категории" first (what needs a category), then the categories in the
 * categories' order; the most frequent merchants first. Tap opens the card; a long press selects several, to give
 * them one category or delete them.
 */
export default function MerchantsScreen() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  // the categories' order (as on the categories screen)
  const [order, setOrder] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([listMerchants(), listCategories(), categoryColors()]).then(([m, cats, colorOf]) => {
      setMerchants(m);
      setOrder(cats.map((c) => c.id));
      setCategories(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }])));
    }).catch((e) => console.error('load merchants failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const words = normalizeForSearch(query);
  const shown = useMemo(() => (words
    ? merchants.filter((m) => normalizeForSearch(m.name).includes(words))
    : merchants), [merchants, words]);

  // one section per category with merchants bought at in the last month (RECENT_DAYS); a merchant whose category is
  // gone counts as without one. The others (a shop visited once long ago) wait collapsed at the bottom: nothing is
  // deleted, a search shows them all in their categories, and a new purchase brings one back
  const [staleOpen, setStaleOpen] = useState(false);
  const sections = useMemo<Section[]>(() => {
    const by = new Map<number | null, MerchantRow[]>();
    const stale: MerchantRow[] = [];
    for (const m of shown) {
      if (!words && !m.activity.recent) { stale.push(m); continue; }
      const c = m.category_id !== null && categories.has(m.category_id) ? m.category_id : null;
      by.set(c, [...(by.get(c) ?? []), m]);
    }
    const out: Section[] = [null, ...order].filter((c) => by.has(c)).map((c) => ({
      key: String(c),
      title: c === null ? NO_CATEGORY : categories.get(c)!.label,
      count: by.get(c)!.length,
      data: by.get(c)!,
    }));
    if (stale.length) out.push({ key: 'stale', title: 'Давно не было покупок', count: stale.length, stale: true, data: staleOpen ? stale : [] });
    return out;
  }, [shown, words, categories, order, staleOpen]);

  // a long press on a merchant starts selecting several, with it selected; unselecting the last one ends it
  const longPressed = useRef(false);
  function startSelect(id: string) {
    setSelectMode(true);
    setSelected([id]);
  }

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    if (next.length === 0) setSelectMode(false);
  }

  // a merchant: its operations stay with their categories, without the merchant
  function confirmDelete() {
    const picked = merchants.filter((m) => selected.includes(m.id));
    const n = picked.reduce((a, m) => a + m.count, 0);
    const one = picked.length === 1;
    sheetAlert(
      one ? `Удалить мерчанта «${picked[0].name}»?` : `Удалить мерчантов (${picked.length})?`,
      `${n} ${plural(n, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
        + `Новые операции ${one ? 'этого мерчанта' : 'этих мерчантов'} не будут получать категорию автоматически. `
        + `Новые SMS от ${one ? 'него снова создадут мерчанта' : 'них снова создадут мерчантов'}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: one ? 'Удалить мерчанта' : `Удалить (${picked.length})`,
          style: 'destructive',
          onPress: () => {
            deleteMerchants(picked.map((m) => m.id)).then(() => {
              done();
              emitTransactionsChanged();
              toast(one ? `Мерчант «${picked[0].name}» удалён` : `Удалено мерчантов: ${picked.length}`);
            }).catch((e) => { console.error('delete merchants failed', e); toastError('Не удалось удалить'); });
          },
        },
      ]);
  }

  // one category for the selected merchants: what it changes, then save
  async function pickCategory(categoryId: number | null) {
    setPickOpen(false);
    if (categoryId === null) return;
    const picked = merchants.filter((m) => selected.includes(m.id));
    // a category just created from the picker isn't in the list yet
    const label = categories.get(categoryId)?.label ?? await categoryLabelOf(categoryId);
    const change = await merchantsCategoryPreview(picked.map((m) => m.id), categoryId)
      .catch((e) => { console.error('preview failed', e); return null; });
    const n = picked.length;
    const who = `${n} ${plural(n, ['мерчанта', 'мерчантов', 'мерчантов'])}`;
    sheetAlert(
      `Категория «${label}» для ${who}?`,
      `Новые операции ${n === 1 ? 'мерчанта' : 'этих мерчантов'} будут получать её автоматически.${change && change.count > 0
        ? ` Категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}.`
        : ''} Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить', onPress: () => {
            setMerchantsCategory(picked.map((m) => m.id), categoryId).then(() => {
              done();
              emitTransactionsChanged();
              toast(`Категория «${label}» назначена: ${n} ${plural(n, ['мерчант', 'мерчанта', 'мерчантов'])}`);
            }).catch((e) => { console.error('set merchants category failed', e); toastError('Не удалось сохранить'); });
          },
        },
      ]);
  }

  /** After a bulk action: out of the selection, the list reloads (onTransactionsChanged). */
  function done() {
    setSelectMode(false);
    setSelected([]);
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
        {selectMode ? (
          <View style={styles.selectBar}>
            <Text style={styles.selectLabel}>Выбрано: {selected.length}</Text>
            <TouchableOpacity onPress={done} hitSlop={8} accessibilityRole="button">
              <Text style={styles.cancelSelect}>Отмена</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => {
          // a grey band, like the days on the operations: "🛒 Еда · 5 мерчантов"
          const title = `${section.title} · ${section.count} ${plural(section.count, ['мерчант', 'мерчанта', 'мерчантов'])}`;
          return section.stale ? (
            <TouchableOpacity
              style={[formStyles.sectionHeader, styles.staleHeader]}
              onPress={() => setStaleOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: staleOpen }}
            >
              <Text style={styles.staleTitle}>{title}</Text>
              <Text style={styles.staleToggle}>{staleOpen ? 'Свернуть' : 'Показать'}</Text>
            </TouchableOpacity>
          ) : <Text style={formStyles.sectionHeader}>{title}</Text>;
        }}
        renderItem={({ item, section }) => {
          const on = selected.includes(item.id);
          // the stale section mixes categories: each row names its own
          const cat = section.stale ? (item.category_id !== null ? categories.get(item.category_id)?.label : undefined) ?? NO_CATEGORY : null;
          return (
            <TouchableOpacity
              style={styles.row}
              // a long press starts selecting (with this one); while selecting a tap toggles, otherwise opens the card.
              // Android also delivers a press when the finger lifts after a long press: skipped, it would unselect
              onPress={() => {
                if (longPressed.current) { longPressed.current = false; return; }
                if (selectMode) toggle(item.id); else setCardId(item.id);
              }}
              onLongPress={selectMode ? undefined : () => { longPressed.current = true; startSelect(item.id); }}
              onPressIn={() => { longPressed.current = false; }}
            >
              {selectMode ? <Checkbox checked={on} size={20} /> : null}
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={2}>{cat ? `${cat} · ` : ''}{activityText(item.activity)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{query ? 'Не найдено.' : 'Мерчанты появятся после первых покупок.'}</Text>}
        ListFooterComponent={<View style={styles.footer} />}
      />

      {selectMode ? (
        <View style={styles.bottomBar}>
          {selected.length === 0 ? null : (
            <View style={styles.bottomActions}>
              <Button title={`Категория (${selected.length})`} onPress={() => setPickOpen(true)} style={styles.bottomButton} />
              <Button title={`Удалить (${selected.length})`} danger onPress={confirmDelete} style={styles.bottomButton} />
            </View>
          )}
        </View>
      ) : null}

      <CategoryPickerModal
        visible={pickOpen}
        title={`Категория для мерчантов (${selected.length})`}
        onPick={pickCategory}
        onClose={() => setPickOpen(false)}
      />
      <MerchantCard merchantId={cardId} categories={categories} onClose={() => setCardId(null)} onChanged={load} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // room under the search: the first section band doesn't stick to it
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
  selectBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  selectLabel: { fontSize: 15, color: colors.text },
  cancelSelect: { fontSize: 15, color: colors.accent },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowMain: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  staleHeader: { flexDirection: 'row', alignItems: 'center' },
  staleTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  staleToggle: { fontSize: 13, color: colors.accent },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  footer: { height: 88 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  bottomActions: { flexDirection: 'row', gap: 10 },
  bottomButton: { flex: 1 },
});
