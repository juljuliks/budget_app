// «Сбережения» of the month stats. A plain function returning a fragment, not a component: StickyScrollView sticks the
// SectionHeaders it finds among its children and opened fragments only.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { fundProgress } from '@/entities/plan';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { InfoIcon } from '@/shared/ui/icons';
import { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { colors } from '@/shared/theme/theme';
import type { SavingsPart, SavingsSection } from '../model/savingsSection';
import { header } from './sections';
import { styles } from './styles';

type Open = {
  /** ⓘ: what the overspend took ("Сбережения меньше на …") */
  less: () => void;
  /** "Подвести итоги ›" */
  close: (ym: string) => void;
};

/** "now / plan ₾ (%)"; not known yet — "? / plan ₾". "Скрыть суммы": the % alone. */
function nowOfPlan(now: number | null, plan: number, currency: string) {
  const pct = now === null ? '?' : formatPercent(Math.max(0, now), plan);
  return (
    <MaskedTotal style={styles.rowAmount} hiddenText={pct}>
      <Text style={now !== null && now < plan ? styles.overNum : undefined}>{now === null ? '?' : formatShort(Math.max(0, now))}</Text>
      <Text style={styles.rowLimit}>{` / ${formatWithCurrency(plan, currency)}`}</Text>
      {now !== null && now < plan ? <Text style={[styles.rowLimit, styles.overNum]}>{` (${pct})`}</Text> : null}
    </MaskedTotal>
  );
}

function Part({ x, currency, onLess }: { x: SavingsPart; currency: string; onLess: () => void }) {
  const status = (
    <Text style={[styles.rowStatus, x.status.tone === 'warn' && styles.overLine, x.status.tone === 'ok' && styles.paceOk]}>
      {x.status.text}{x.fund ? ` · ${fundProgress(x.fund.saved, x.fund.target, x.fund.due, x.fund.currency)}` : ''}{x.status.info ? ' ' : ''}
    </Text>
  );
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: x.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{x.name}</Text>
        {nowOfPlan(x.now, x.plan, currency)}
      </View>
      {x.plan > 0 && x.now !== null ? <Meter ratio={Math.max(0, x.now) / x.plan} height={6} color={x.color} /> : null}
      {x.status.info ? (
        <TouchableOpacity style={styles.rowTop} onPress={onLess} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${x.name}: что съело сбережения`}>
          {status}<InfoIcon color={colors.accent} size={13} />
        </TouchableOpacity>
      ) : status}
    </View>
  );
}

/**
 * The parts — 🔒 "Отложено сразу", the funds' contributions, 💰 "Сэкономлено" — each "сейчас / план" with its bar and
 * how it goes ("Перерасход взял 5.28 ₾ ⓘ"); what none covers — "Из прошлых сбережений −N ⓘ"; "Итоги" not done —
 * "Подвести итоги ›".
 */
export function savingsSection(s: SavingsSection | null, currency: string, open: Open) {
  if (!s) return null;
  const money = (minor: number) => formatWithCurrency(minor, currency);
  return (
    <>
      {header('Сбережения', nowOfPlan(s.now, s.plan, currency))}
      <View>
        {s.caption ? <Text style={styles.savingsCaption}>{s.caption}</Text> : null}
        {s.parts.map((x) => <Part key={x.key} x={x} currency={currency} onLess={open.less} />)}
        {s.past > 0 ? (
          <TouchableOpacity style={styles.row} onPress={open.less} accessibilityRole="button" accessibilityLabel="Из прошлых сбережений: что съело сбережения">
            <View style={styles.rowTop}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <Text style={styles.rowName}>Из прошлых сбережений</Text>
              <MaskedTotal style={[styles.rowAmount, styles.dangerText]} hiddenText="">{`−${money(s.past)}`}</MaskedTotal>
              <View style={styles.infoGap}><InfoIcon color={colors.accent} size={13} /></View>
            </View>
          </TouchableOpacity>
        ) : null}
        {s.closeYm ? (
          <TouchableOpacity onPress={() => open.close(s.closeYm!)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.closeLink}>Подвести итоги ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}
