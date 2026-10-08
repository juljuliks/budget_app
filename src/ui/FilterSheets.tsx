import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetFlatList } from './BottomSheet';
import Button from './Button';
import Checkbox from './Checkbox';
import Chip from './Chip';
import { ChevronDownIcon, SearchIcon } from './icons';
import RangeCalendar, { DayRange, formatRange } from './RangeCalendar';
import { colors } from './theme';
import { normalizeForSearch } from '../db/transactions';

/** "Категория ⌄" / "Мерчант · 2 ⌄" / "Дата ⌄": opens its picker sheet; blue while set. */
export function FilterButton({ label, count, active, onPress, disabled, testID }: {
  label: string; count?: number; active: boolean; onPress: () => void;
  /** set and locked (sorting out a category being deleted: its category) */
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, active && styles.buttonOn, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
    >
      <Text style={[styles.buttonText, active && styles.buttonTextOn]}>{count ? `${label} · ${count}` : label}</Text>
      <ChevronDownIcon color={active ? '#FFFFFF' : colors.accent} size={14} />
    </TouchableOpacity>
  );
}

export type Option<K> = { key: K; label: string; count: number; muted?: boolean };

/** Categories / merchants to pick (several), with their operation counts; changes apply at once. */
export function OptionsSheet<K extends string | number>({
  visible, title, options, selected, onToggle, onClear, onClose, searchPlaceholder,
}: {
  visible: boolean; title: string; options: Option<K>[]; selected: K[];
  onToggle: (key: K) => void; onClear: () => void; onClose: () => void;
  /** a search field on top (long lists: merchants) */
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const words = normalizeForSearch(query);
  const shown = words ? options.filter((o) => normalizeForSearch(o.label).includes(words)) : options;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={styles.sheet}>
      {searchPlaceholder ? (
        <View style={styles.search}>
          <SearchIcon color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Очистить">
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <SheetFlatList
        data={shown}
        keyExtractor={(o) => String(o.key)}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{query ? 'Не найдено' : 'Пока пусто'}</Text>}
        renderItem={({ item }) => {
          const on = selected.includes(item.key);
          return (
            <TouchableOpacity style={styles.option} onPress={() => onToggle(item.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Checkbox checked={on} size={20} />
              <Text style={[styles.optionLabel, item.muted && styles.muted]} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.count}>{item.count}</Text>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.footer}>
        <Button title="Готово" onPress={onClose} />
        {selected.length ? (
          <TouchableOpacity style={styles.secondary} onPress={onClear}>
            <Text style={styles.secondaryText}>Снять выбор</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** A day or a period: the calendar in a sheet. */
export function DateSheet({ visible, value, onChange, onClose }: {
  visible: boolean; value: DayRange | null; onChange: (r: DayRange | null) => void; onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={value ? formatRange(value) : 'Дата'}>
      <View style={styles.calendar}>
        <RangeCalendar value={value} onChange={onChange} />
      </View>
      <View style={styles.footer}>
        <Button title="Готово" onPress={onClose} />
        {value ? (
          <TouchableOpacity style={styles.secondary} onPress={() => onChange(null)}>
            <Text style={styles.secondaryText}>Сбросить даты</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
}

export type ActiveFilter = { key: string; label: string; clear: () => void };

/** Every filter set, each with ✕, and "Сбросить все". */
export function AllFiltersSheet({ visible, filters, onReset, onClose }: {
  visible: boolean; filters: ActiveFilter[]; onReset: () => void; onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Фильтры">
      <View style={[styles.chipsWrap, styles.allChips]}>
        {filters.map((f) => <Chip key={f.key} small selected label={f.label} trailing="✕" onPress={f.clear} />)}
        {filters.length ? <Chip small action label="Сбросить все" onPress={() => { onReset(); onClose(); }} /> : (
          <Text style={styles.empty}>Фильтров нет</Text>
        )}
      </View>
      <View style={styles.footer}>
        <Button title="Готово" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  buttonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 13, color: colors.text },
  buttonTextOn: { color: '#FFFFFF' },
  sheet: { maxHeight: '85%' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8, color: colors.text },
  clear: { fontSize: 16, color: colors.muted },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  optionLabel: { flex: 1, fontSize: 15, color: colors.text },
  muted: { color: colors.muted },
  count: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  calendar: { paddingHorizontal: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  allChips: { paddingHorizontal: 20, paddingVertical: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  secondary: { alignItems: 'center', paddingTop: 12 },
  secondaryText: { fontSize: 15, color: colors.accent },
});
