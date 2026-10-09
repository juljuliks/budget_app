import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { currentYm, getPlanBudget, monthStats, parseYm, planConverter, unplannedOf, unplannedSpent } from '../../db/plans';
import { getSetting, setSetting } from '../../db/settings';
import { Currency } from '../../db/fx';
import { onTransactionsChanged } from '../../events';
import { formatWithCurrency } from '../money';
import { colors } from '../theme';

const DISMISSED_KEY = 'plan_alert_dismissed';
/** "До отложенного осталось …" once what may be spent (budget − 🔒) is down to this share */
const LOCK_NEAR = 0.1;

/**
 * Over the stats, for the current month: spending close to the 🔒 locked savings or already in them, and spending outside
 * the plan past its share. ✕ hides what is shown; a new warning brings it back.
 */
export default function PlanAlert({ currency }: { currency: Currency }) {
  const [alert, setAlert] = useState<{ text: string; key: string } | null>(null);
  const load = useCallback(() => {
    const ym = currentYm();
    const { year, month } = parseYm(ym);
    Promise.all([monthStats(year, month, currency), getPlanBudget(ym), planConverter(ym), getSetting(DISMISSED_KEY)]).then(([stats, budget, conv, dismissed]) => {
      const money = (minor: number) => formatWithCurrency(minor, stats.currency);
      const items: Array<{ key: string; text: string }> = [];
      // 🔒 locked savings: spending close to them, or already in them
      const amount = budget ? conv(budget.amount_minor, budget.currency, stats.currency) : null;
      const locked = budget ? conv(budget.locked_minor, budget.currency, stats.currency) ?? 0 : 0;
      if (amount !== null && locked > 0) {
        const left = amount - locked - stats.spent_minor;
        if (left < 0) items.push({ key: 'lock-in', text: `Траты зашли в отложенное: из сбережений ушло ${money(-left)}` });
        else if (left <= (amount - locked) * LOCK_NEAR) items.push({ key: 'lock-near', text: `До отложенного осталось ${money(left)} — дальше траты пойдут из сбережений` });
      }
      // spending outside the plan past its share
      const spent = unplannedSpent(stats);
      const share = budget ? conv(unplannedOf(budget), budget.currency, stats.currency) ?? 0 : 0;
      const over = spent - share;
      if (over > 0) {
        items.push({
          key: 'over',
          text: share > 0
            ? `Вне плана потрачено ${money(spent)} — на ${money(over)} больше, чем выделено на траты вне плана`
            : budget?.unplanned_pct === 0
              ? `Вне плана потрачено ${money(spent)}: на траты вне плана в бюджете ничего не выделено`
              : `Вне плана потрачено ${money(spent)}`,
        });
      }
      // ✕ hides what is shown now; something new brings it back
      const key = `${ym}:${items.map((i) => i.key).join(',')}`;
      setAlert(items.length && dismissed !== key ? { key, text: items.map((i) => i.text).join('\n') } : null);
    }).catch((e) => console.error('load plan alert failed', e));
  }, [currency]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!alert) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.text}>⚠ {alert.text}</Text>
      <TouchableOpacity
        onPress={() => { setAlert(null); setSetting(DISMISSED_KEY, alert.key).catch((e) => console.error('save alert dismissal failed', e)); }}
        hitSlop={10}
        accessibilityLabel="Скрыть предупреждение"
      >
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.warnBg,
  },
  text: { flex: 1, fontSize: 14, color: colors.warn },
  close: { fontSize: 16, color: colors.warn },
});
