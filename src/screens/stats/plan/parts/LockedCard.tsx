import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { LockIcon } from '@/shared/ui/icons';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import type { LockedOfForm } from '../model/budgetForm';
import { RING_LOCKED } from './palette';

/**
 * «🔒 Отложить сразу» in the budget sheet: no field — the % is set in the settings. «15% · 300 $»; taken this month
 * («копилкам не хватило свободного −35 $»); not set — a yellow warning.
 */
export default function LockedCard({ l, currency, onSettings }: { l: LockedOfForm; currency: Currency; onSettings: () => void }) {
  const money = (v: number) => formatWithCurrency(v, currency);
  if (l.kind === 'none') {
    return (
      <View style={[styles.card, styles.warn]} accessibilityRole="alert">
        <Text style={styles.warnText}>⚠ Не задано, сколько откладывать сразу: в сбережения уйдёт только то, что останется в конце месяца.</Text>
        <TextLink label="Задать в Настройках" onPress={onSettings} style={styles.link} containerStyle={styles.linkBox} />
      </View>
    );
  }
  const taken = l.kind === 'pct' && l.taken > 0 ? l : null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <LockIcon color={RING_LOCKED} size={14} />
        <Text style={styles.title}>ОТЛОЖИТЬ СРАЗУ</Text>
        <Text style={styles.value}>{l.kind === 'pct' && !taken ? `${l.pct}% · ${money(l.locked)}` : money(l.locked)}</Text>
      </View>
      {taken ? (
        <>
          <View style={styles.line}><Text style={styles.muted}>{`${taken.pct}% бюджета`}</Text><Text style={styles.muted}>{money(taken.full)}</Text></View>
          <View style={styles.line}>
            <Text style={styles.muted}>{taken.funds ? 'копилкам не хватило свободного' : 'плану не хватило свободного'}</Text>
            <Text style={styles.muted}>{`−${money(Math.min(taken.taken, taken.full))}`}</Text>
          </View>
          <Text style={styles.note}>Только в этом месяце: процент в Настройках не меняется.</Text>
          <TextLink label="Настройки" onPress={onSettings} style={styles.link} containerStyle={styles.linkBox} />
        </>
      ) : (
        <>
          <Text style={styles.note}>Сразу в сбережения: план и траты вне плана их не займут.</Text>
          <TextLink label="Процент — в Настройках" onPress={onSettings} style={styles.link} containerStyle={styles.linkBox} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.savingsBg },
  warn: { backgroundColor: colors.warnBg },
  warnText: { fontSize: 14, color: colors.warn },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '700', color: RING_LOCKED, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  muted: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: colors.muted, marginTop: 6 },
  link: { fontSize: 13 },
  linkBox: { marginTop: 4, alignSelf: 'flex-start' },
});
