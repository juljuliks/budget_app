import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { LockIcon } from '@/shared/ui/icons';
import Banner from '@/shared/ui/Banner';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import type { LockedOfForm } from '../model/budgetForm';
import { RING_LOCKED } from './palette';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/**
 * «🔒 Отложить сразу» in the budget sheet: no field — the % is set in the settings. «15% · 300 $»; taken this month
 * («копилкам не хватило свободного −35 $»); not set — a yellow warning.
 */
export default function LockedCard({
  l,
  currency,
  onSettings,
}: {
  l: LockedOfForm;
  currency: Currency;
  onSettings: () => void;
}) {
  const money = (v: number) => formatWithCurrency(v, currency);
  if (l.kind === 'none') {
    return (
      <Banner
        text="⚠ Не задано, сколько откладывать сразу: в сбережения уйдёт только то, что останется в конце месяца."
        alert
        style={styles.warn}
      >
        <TextLink
          label="Задать в Настройках"
          onPress={onSettings}
          style={styles.link}
          containerStyle={styles.linkBox}
        />
      </Banner>
    );
  }
  const taken = l.kind === 'pct' && l.taken > 0 ? l : null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <LockIcon color={RING_LOCKED} size={14} />
        <Text style={styles.title}>ОТЛОЖИТЬ СРАЗУ</Text>
        <Text style={styles.value}>
          {l.kind === 'pct' && !taken ? `${l.pct}% · ${money(l.locked)}` : money(l.locked)}
        </Text>
      </View>
      {taken ? (
        <>
          <View style={styles.line}>
            <Text style={styles.muted}>{`${taken.pct}% бюджета`}</Text>
            <Text style={styles.muted}>{money(taken.full)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.muted}>
              {taken.funds ? 'копилкам не хватило свободного' : 'плану не хватило свободного'}
            </Text>
            <Text style={styles.muted}>{`−${money(Math.min(taken.taken, taken.full))}`}</Text>
          </View>
          <Text style={styles.note}>Только в этом месяце: процент в Настройках не меняется.</Text>
          <TextLink label="Настройки" onPress={onSettings} style={styles.link} containerStyle={styles.linkBox} />
        </>
      ) : (
        <>
          <Text style={styles.note}>Сразу в сбережения: план и траты вне плана их не займут.</Text>
          <TextLink
            label="Процент — в Настройках"
            onPress={onSettings}
            style={styles.link}
            containerStyle={styles.linkBox}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space[12], padding: space[12], borderRadius: radius.lg, backgroundColor: colors.savingsBg },
  warn: { marginTop: space[12] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[6] },
  title: { flex: 1, fontSize: font.meta, fontWeight: weight.bold, color: colors.muted, letterSpacing: 0.3 },
  value: { fontSize: font.body, fontWeight: weight.bold, color: RING_LOCKED, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[4] },
  muted: { fontSize: font.meta, color: colors.muted, fontVariant: ['tabular-nums'] },
  note: { fontSize: font.meta, color: colors.muted, marginTop: space[6] },
  link: { fontSize: font.meta },
  linkBox: { marginTop: space[4], alignSelf: 'flex-start' },
});
