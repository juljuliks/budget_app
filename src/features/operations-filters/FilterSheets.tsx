import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetFlatList } from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import Checkbox from '@/shared/ui/Checkbox';
import Chip from '@/shared/ui/Chip';
import { ChevronDownIcon, SearchIcon } from '@/shared/ui/icons';
import RangeCalendar, { DayRange, formatRange } from '@/shared/ui/RangeCalendar';
import { colors } from '@/shared/theme/theme';
import { normalizeForSearch } from '@/db/transactions';
import { font, radius, space } from '@/shared/theme/tokens';
import Empty from '@/shared/ui/Empty';

/** "Категория ⌄" / "Мерчант · 2 ⌄" / "Дата ⌄": opens its picker sheet; blue while set. */
export function FilterButton({
  label,
  count,
  active,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
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
      <ChevronDownIcon color={active ? colors.onAccent : colors.accent} size={14} />
    </TouchableOpacity>
  );
}

export type Option<K> = { key: K; label: string; count: number; muted?: boolean };

/** Categories / merchants to pick (several), with their operation counts; changes apply at once. */
export function OptionsSheet<K extends string | number>({
  visible,
  title,
  options,
  selected,
  onToggle,
  onClear,
  onClose,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  options: Option<K>[];
  selected: K[];
  onToggle: (key: K) => void;
  onClear: () => void;
  onClose: () => void;
  /** a search field on top (long lists: merchants) */
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const words = normalizeForSearch(query);
  const shown = words ? options.filter((o) => normalizeForSearch(o.label).includes(words)) : options;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      style={styles.sheet}
      // right of the title, as the toolbars' "Отмена": shown once something is picked
      headerRight={selected.length ? <Button variant="text" title="Снять выбор" onPress={onClear} /> : null}
    >
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
            // eslint-disable-next-line app/text-button -- the search field's ✕
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityLabel="Очистить"
            >
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
        ListEmptyComponent={<Empty compact>{query ? 'Не найдено' : 'Пока пусто'}</Empty>}
        renderItem={({ item }) => {
          const on = selected.includes(item.key);
          return (
            <TouchableOpacity
              style={styles.option}
              onPress={() => onToggle(item.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Checkbox checked={on} size={20} />
              <Text style={[styles.optionLabel, item.muted && styles.muted]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.count}>{item.count}</Text>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.footer}>
        <Button title="Готово" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

/** A day or a period: the calendar in a sheet. */
export function DateSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: DayRange | null;
  onChange: (r: DayRange | null) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={value ? formatRange(value) : 'Дата'}>
      <View style={styles.calendar}>
        <RangeCalendar value={value} onChange={onChange} />
      </View>
      <View style={styles.footer}>
        <Button title="Готово" onPress={onClose} />
        {value ? (
          <Button variant="text" title="Сбросить даты" onPress={() => onChange(null)} style={styles.secondary} />
        ) : null}
      </View>
    </BottomSheet>
  );
}

export type ActiveFilter = { key: string; label: string; clear: () => void };

/** Every filter set, each with ✕, and "Сбросить все". */
export function AllFiltersSheet({
  visible,
  filters,
  onReset,
  onClose,
}: {
  visible: boolean;
  filters: ActiveFilter[];
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Фильтры">
      <View style={[styles.chipsWrap, styles.allChips]}>
        {filters.map((f) => (
          <Chip key={f.key} small selected label={f.label} trailing="✕" onPress={f.clear} />
        ))}
        {filters.length ? (
          <Chip
            small
            action
            label="Сбросить все"
            onPress={() => {
              onReset();
              onClose();
            }}
          />
        ) : (
          <Empty compact>Фильтров нет</Empty>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[10],
    paddingVertical: space[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  buttonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: font.meta, color: colors.text },
  buttonTextOn: { color: colors.onAccent },
  sheet: { maxHeight: '85%' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    marginHorizontal: space[20],
    marginBottom: space[8],
    paddingHorizontal: space[12],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: font.body, paddingVertical: space[8], color: colors.text },
  clear: { fontSize: font.input, color: colors.muted },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[20],
    paddingVertical: space[12],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  optionLabel: { flex: 1, fontSize: font.body, color: colors.text },
  muted: { color: colors.muted },
  count: { fontSize: font.meta, color: colors.muted, fontVariant: ['tabular-nums'] },
  calendar: { paddingHorizontal: space[16] },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[6] },
  allChips: { paddingHorizontal: space[20], paddingVertical: space[8] },
  footer: { paddingHorizontal: space[20], paddingTop: space[12] },
  secondary: { alignItems: 'center', paddingTop: space[12] },
});
