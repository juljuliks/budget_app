import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DayKey, dayKeyOf } from '@/shared/lib/dateRange';
import BottomSheet from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import RangeCalendar from '@/shared/ui/RangeCalendar';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { dayLabel } from '../model/dayLabel';

/** "Дата": the day picked ("Сегодня, 5 октября"), "Изменить" opens the calendar (no day after today). */
export default function DateField({ value, onChange }: { value: DayKey; onChange: (d: DayKey) => void }) {
  const [open, setOpen] = useState(false);
  // the day being picked in the calendar
  const [draft, setDraft] = useState<DayKey | null>(null);
  return (
    <>
      <Text style={formStyles.label}>Дата</Text>
      <View style={styles.row}>
        <Text style={styles.date}>{dayLabel(value)}</Text>
        <TouchableOpacity onPress={() => { setDraft(value); setOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Изменить дату">
          <Text style={styles.change}>Изменить</Text>
        </TouchableOpacity>
      </View>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Дата операции">
        <View style={styles.sheet}>
          <RangeCalendar value={draft ? { from: draft, to: draft } : null} onChange={(r) => setDraft(r.from)} single maxDay={dayKeyOf(new Date())} />
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
  date: { fontSize: 16, color: colors.text },
  change: { fontSize: 15, color: colors.accent },
  sheet: { paddingHorizontal: 16 },
});
