import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Fund, FundForecast } from '@/db/plans';
import Button from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { changeFundGoal } from '../model/commands';
import { forecastText } from '../model/forecastText';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/**
 * A fund's card on its category's page: «✓ Успеваете к 31 июля» (green) or «⚠ Не успеваете к 31 июля» (yellow) with
 * why, and the two ways out — «Сдвинуть на …», «Копить … к …», saved at once.
 */
export default function FundForecastBox({
  forecast,
  fund,
  label,
}: {
  forecast: FundForecast;
  fund: Fund;
  label: string;
}) {
  const t = forecastText(forecast);
  const was = {
    target_minor: fund.target_minor,
    currency: fund.currency,
    due: fund.due,
    start_minor: fund.start_minor,
  };
  return (
    <View style={[styles.box, t.ok ? styles.ok : styles.late]}>
      <Text style={[styles.title, t.ok ? styles.okText : styles.lateText]}>{t.title}</Text>
      {t.lines.map((l) => (
        <Text key={l} style={styles.line}>
          {l}
        </Text>
      ))}
      {t.move || t.keep ? (
        <View style={styles.actions}>
          {t.move ? (
            <Button
              title={t.move.label}
              onPress={() => changeFundGoal(fund.category_id, label, was, { due: t.move!.due })}
            />
          ) : null}
          {t.keep ? (
            <Button
              title={t.keep.label}
              variant="secondary"
              onPress={() => changeFundGoal(fund.category_id, label, was, { target_minor: t.keep!.target })}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: space[12], borderRadius: radius.lg, paddingHorizontal: space[14], paddingVertical: space[12] },
  ok: { backgroundColor: colors.savingsBg },
  late: { backgroundColor: colors.warnBg },
  title: { fontSize: font.input, fontWeight: weight.bold },
  okText: { color: colors.income },
  lateText: { color: colors.warn },
  line: { fontSize: font.secondary, color: colors.text, marginTop: space[4], lineHeight: 19 },
  actions: { gap: space[10], marginTop: space[12] },
});
