import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { LimitIcon, LockIcon, OneOffIcon, RepeatIcon } from '@/shared/ui/icons';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';
import { PinBadge } from './PlanIcon';

const ROWS: Array<{ icon: React.ReactNode; title: string; note: string }> = [
  { icon: <LimitIcon color={colors.muted} />, title: 'Траты с лимитом', note: 'Сумма меняется — следим, сколько осталось' },
  { icon: <OneOffIcon color={colors.muted} />, title: 'Разовый платёж', note: 'Известная сумма в этом месяце' },
  { icon: <RepeatIcon color={colors.accent} size={22} />, title: 'Регулярный платёж', note: 'Переходит в следующий месяц всегда, сумма — по датам списаний' },
  {
    icon: <PinBadge />, title: 'Повторять каждый месяц',
    note: 'В углу значка: в следующем месяце будет в плане с той же суммой. Включается в шите категории',
  },
  { icon: <ProgressRing ratio={0.4} color={colors.fund} track={colors.fundTrack} size={22} />, title: 'Копилка', note: 'Кольцо — сколько накоплено из цели' },
  { icon: <LockIcon color={colors.muted} size={20} />, title: 'Часть бюджета', note: 'Отложено сразу и траты вне плана — задаются в бюджете месяца' },
];

/** "Что значат значки" under the budget: what each icon of the plan's rows means. */
export default function PlanIconsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Значки плана">
      <SheetScrollView contentContainerStyle={styles.content}>
        {ROWS.map((r, i) => (
          <View key={r.title} style={[styles.row, i < ROWS.length - 1 && styles.rule]}>
            <View style={styles.icon}>{r.icon}</View>
            <View style={styles.text}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.note}>{r.note}</Text>
            </View>
          </View>
        ))}
        <SheetActions submit={{ title: 'Понятно', onPress: onClose }} />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  icon: { width: 28, alignItems: 'center', paddingTop: 2 },
  text: { flex: 1 },
  title: { fontSize: 16, color: colors.text },
  note: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
