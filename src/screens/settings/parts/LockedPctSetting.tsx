import React from 'react';
import { Text, View } from 'react-native';
import { saveLockedPct, useLockedPct } from '@/shared/settings/lockedPct';
import StepSlider from '@/shared/ui/StepSlider';
import { toastFailure } from '@/shared/ui/toast';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import { styles } from './styles';

const STOPS = [0, 5, 10, 15, 20, 25, 30];
// the savings' colour (the plan's 🔒)
const LOCKED = colors.savingsText;

/**
 * «🔒 Отложить сразу»: what % of each month's budget goes to the savings at once. Not set (not the same as 0%) — only
 * what is left at the month's end is saved. A change applies to the current and coming months and the past ones not closed.
 */
export default function LockedPctSetting() {
  const pct = useLockedPct();
  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={[styles.label, styles.flex]}>🔒 Отложить сразу</Text>
        <Text style={[styles.value, { color: pct === null ? colors.muted : LOCKED }]}>{pct === null ? 'не задано' : `${pct}% бюджета`}</Text>
      </View>
      <Text style={styles.hint}>Каждый месяц столько от бюджета месяца сразу в сбережения: план и траты вне плана их не займут.</Text>
      <StepSlider
        values={STOPS} value={pct ?? -1} label={(v) => `${v}%`} color={LOCKED}
        onChange={(v) => { saveLockedPct(v).catch(toastFailure('save locked pct', SAVE_FAILED)); }}
      />
      <Text style={[styles.hint, styles.after]}>
        Что план не распределит или категории не потратят — тоже в сбережения, как «💰 Сэкономлено». Новый процент — с этого месяца.
      </Text>
    </View>
  );
}
