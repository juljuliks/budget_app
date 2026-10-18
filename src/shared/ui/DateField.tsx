import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DayKey } from '../lib/dateRange';
import { formStyles } from '../theme/formStyles';
import { colors } from '../theme/theme';
import BottomSheet from './BottomSheet';
import { SheetActions } from './Button';
import RangeCalendar from './RangeCalendar';

type Props = {
  /** above the row ("Дата", "К какой дате") */
  label: string;
  /** null = not picked yet: "Не выбрана" and "Выбрать" */
  value: DayKey | null;
  onChange: (d: DayKey) => void;
  /** how the day reads ("Сегодня, 5 октября", "31 июля 2027") */
  format: (d: DayKey) => string;
  /** muted after the day (" · через 9 месяцев") */
  suffix?: string | null;
  /** the calendar sheet's title */
  sheetTitle: string;
  minDay?: DayKey;
  maxDay?: DayKey;
};

/**
 * A day in a form, one look across the app: the day as text with "Изменить" on the right (none yet — "Не выбрана",
 * "Выбрать"); a tap opens the calendar in a sheet, "Выбрать" sets it.
 */
export default function DateField({ label, value, onChange, format, suffix, sheetTitle, minDay, maxDay }: Props) {
  const [open, setOpen] = useState(false);
  // the day being picked in the calendar
  const [draft, setDraft] = useState<DayKey | null>(null);
  return (
    <>
      <Text style={formStyles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.date, !value && styles.muted]}>
          {value ? format(value) : 'Не выбрана'}
          {value && suffix ? <Text style={styles.muted}>{suffix}</Text> : null}
        </Text>
        <TouchableOpacity onPress={() => { setDraft(value); setOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={value ? 'Изменить дату' : 'Выбрать дату'}>
          <Text style={styles.change}>{value ? 'Изменить' : 'Выбрать'}</Text>
        </TouchableOpacity>
      </View>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle}>
        <View style={styles.sheet}>
          <RangeCalendar value={draft ? { from: draft, to: draft } : null} onChange={(r) => setDraft(r.from)} single minDay={minDay} maxDay={maxDay} />
          <SheetActions
            submit={{ title: 'Выбрать', disabled: !draft, onPress: () => { if (draft) onChange(draft); setOpen(false); } }}
            onCancel={() => setOpen(false)}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { flex: 1, fontSize: 16, color: colors.text },
  muted: { color: colors.muted, fontSize: 14 },
  change: { fontSize: 15, color: colors.accent },
  sheet: { paddingHorizontal: 16 },
});
