import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import BottomSheet, { SheetFlatList } from './BottomSheet';
import { SheetActions } from './Button';
import { SearchIcon } from './icons';
import { colors } from '../theme/theme';
// [emoji, group, emoji version, search words in Russian and English] — built by scripts/build_emoji.js
import EMOJI from './emoji/emoji.json';

type Props = {
  visible: boolean;
  value: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

/** The phone keyboard's groups, in its order, with the tab icon. */
const GROUPS: Array<{ id: number; title: string; icon: string }> = [
  { id: 0, title: 'Смайлы', icon: '😀' },
  { id: 1, title: 'Люди', icon: '👋' },
  { id: 3, title: 'Животные и природа', icon: '🐻' },
  { id: 4, title: 'Еда и напитки', icon: '🍔' },
  { id: 5, title: 'Путешествия и места', icon: '🚗' },
  { id: 6, title: 'Занятия', icon: '⚽' },
  { id: 7, title: 'Предметы', icon: '💡' },
  { id: 8, title: 'Символы', icon: '❤️' },
  { id: 9, title: 'Флаги', icon: '🏳️' },
];

/**
 * The newest emoji version the phone's font draws (Android API level → Emoji version): newer ones would show as
 * empty boxes, so they are not offered.
 */
function maxEmojiVersion(): number {
  const api = Platform.OS === 'android' ? Number(Platform.Version) : 99;
  if (api >= 36) return 16;
  if (api >= 35) return 15.1;
  if (api >= 34) return 15;
  if (api >= 33) return 14;
  if (api >= 31) return 13.1;
  if (api >= 30) return 13;
  if (api >= 29) return 12;
  return 11;
}

const COLUMNS = 8;
const ROW_HEIGHT = 46;
const HEADER_HEIGHT = 34;

type Row = { key: string; header: string } | { key: string; emoji: string[] };

const ALL = (EMOJI as Array<[string, number, number, string]>).filter(([, , v]) => v <= maxEmojiVersion());
// each emoji's words, to match a query by word starts ("еда" finds "еда", not "победа")
const WORDS = new Map(ALL.map(([e, , , w]) => [e, ` ${w.replace(/[^\p{L}\p{N}]+/gu, ' ')}`]));

/** Rows of COLUMNS, under a header per group (none while searching). */
function rowsOf(list: typeof ALL, withHeaders: boolean): { rows: Row[]; groupRow: Map<number, number> } {
  const rows: Row[] = [];
  const groupRow = new Map<number, number>();
  for (const g of withHeaders ? GROUPS : [{ id: -1, title: '', icon: '' }]) {
    const items = withHeaders ? list.filter(([, group]) => group === g.id) : list;
    if (items.length === 0) continue;
    if (withHeaders) {
      groupRow.set(g.id, rows.length);
      rows.push({ key: `h${g.id}`, header: g.title });
    }
    for (let i = 0; i < items.length; i += COLUMNS) {
      rows.push({ key: `${g.id}-${i}`, emoji: items.slice(i, i + COLUMNS).map(([e]) => e) });
    }
  }
  return { rows, groupRow };
}

/**
 * Picking a category's emoji, like the phone keyboard's emoji page: every emoji the phone can draw, in its groups
 * (tabs on top jump to one), and a search by Russian or English words ("кофе", "coffee"). One tap = one emoji.
 */
export default function EmojiPicker({ visible, value, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const list = useRef<FlatList<Row>>(null);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 32) / COLUMNS);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const { rows, groupRow } = useMemo(() => (words.length
    ? rowsOf(ALL.filter(([e]) => words.every((q) => WORDS.get(e)!.includes(` ${q}`))), false)
    : rowsOf(ALL, true)), [words.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps

  // fixed heights: a tab can jump straight to its group
  const offsets = useMemo(() => {
    const o: number[] = [];
    let y = 0;
    for (const r of rows) { o.push(y); y += 'header' in r ? HEADER_HEIGHT : ROW_HEIGHT; }
    return o;
  }, [rows]);

  const pick = (e: string) => { onPick(e); setQuery(''); onClose(); };
  const close = () => { setQuery(''); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={close} title="Эмодзи" style={styles.sheet}>
      <View style={styles.top}>
        <View style={styles.search}>
          <SearchIcon color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск: кофе, coffee…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Очистить поиск">
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {words.length ? null : (
          <View style={styles.tabs}>
            {GROUPS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.tab}
                onPress={() => {
                  const i = groupRow.get(g.id);
                  if (i !== undefined) list.current?.scrollToOffset({ offset: offsets[i], animated: false });
                }}
                accessibilityLabel={g.title}
              >
                <Text style={styles.tabIcon}>{g.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <SheetFlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        getItemLayout={(_, i) => ({ length: 'header' in rows[i] ? HEADER_HEIGHT : ROW_HEIGHT, offset: offsets[i], index: i })}
        initialNumToRender={20}
        windowSize={7}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.empty}>Ничего не найдено</Text>}
        renderItem={({ item }) => ('header' in item ? (
          <Text style={styles.header}>{item.header}</Text>
        ) : (
          <View style={styles.row}>
            {item.emoji.map((e) => (
              <TouchableOpacity key={e} style={[styles.cell, { width: cell }, e === value && styles.selected]} onPress={() => pick(e)} accessibilityLabel={e}>
                <Text style={styles.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      />
      {/* removing the emoji is the ✕ on its tile in the category sheet */}
      <SheetActions submit={null} onCancel={close} style={styles.actions} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // a fixed height: it doesn't jump while searching
  sheet: { height: '85%', maxHeight: '85%' },
  top: { paddingHorizontal: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
  tabs: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tab: { paddingVertical: 8, paddingHorizontal: 4 },
  // an opaque color: Android draws color emoji with the text color's alpha (the default one is translucent)
  tabIcon: { fontSize: 20, color: '#000000' },
  content: { paddingHorizontal: 16, paddingBottom: 8 },
  header: { height: HEADER_HEIGHT, paddingTop: 12, fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  row: { height: ROW_HEIGHT, flexDirection: 'row' },
  cell: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  emoji: { fontSize: 28, color: '#000000' },
  empty: { padding: 24, textAlign: 'center', color: colors.muted },
  actions: { paddingHorizontal: 16, marginTop: 8 },
});
