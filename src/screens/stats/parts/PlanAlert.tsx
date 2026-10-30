import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { currentYm, getPlanBudget, monthStats, parseYm, planConverter, unplannedOf, unplannedSpent } from '@/db/plans';
import { getSetting, setSetting } from '@/db/settings';
import { Currency } from '@/db/fx';
import { onTransactionsChanged } from '@/domain/events';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { formatWithCurrency } from '@/shared/lib/money';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { lessTarget, useMonthSavings } from '../month/model/useMonthSavings';
import { lessTaken } from '../plan/model/savingsLess';
import SavingsLessSheet from '../plan/parts/SavingsLessSheet';

const DISMISSED_KEY = 'plan_alert_dismissed';
/** "До отложенного осталось …" once what may be spent (budget − 🔒) is down to this share */
const LOCK_NEAR = 0.1;

type Item = { key: string; text: string };

/** What is spent now: close to 🔒, and outside the plan past its share. */
async function spentItems(currency: Currency): Promise<Item[]> {
  const ym = currentYm();
  const { year, month } = parseYm(ym);
  const [stats, budget, conv] = await Promise.all([monthStats(year, month, currency), getPlanBudget(ym), planConverter(ym)]);
  const money = (minor: number) => formatWithCurrency(minor, stats.currency);
  const items: Item[] = [];
  const amount = budget ? conv(budget.amount_minor, budget.currency, stats.currency) : null;
  const locked = budget ? conv(budget.locked_minor, budget.currency, stats.currency) ?? 0 : 0;
  if (amount !== null && locked > 0) {
    const left = amount - locked - stats.spent_minor;
    if (left >= 0 && left <= (amount - locked) * LOCK_NEAR) items.push({ key: 'lock-near', text: `До отложенного осталось ${money(left)} — дальше траты пойдут из сбережений` });
  }
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
  return items;
}

/**
 * Over the stats, for the current month: the overspend that went past 💰 into the savings (as «Сбережения» counts it; a
 * tap — «Сбережения меньше на …», part by part), spending close to 🔒, and spending outside the plan past its share.
 * ✕ hides what is shown; a new warning brings it back.
 */
export default function PlanAlert({ currency }: { currency: Currency }) {
  const hidden = useHideAmounts();
  const ym = currentYm();
  const { view } = useMonthSavings(ym, currency, hidden);
  const [spent, setSpent] = useState<Item[]>([]);
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  const load = useCallback(() => {
    Promise.all([spentItems(currency), getSetting(DISMISSED_KEY)])
      .then(([items, d]) => { setSpent(items); setDismissed(d); })
      .catch((e) => console.error('load plan alert failed', e));
  }, [currency]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  const less = view?.less ?? null;
  const taken = less ? lessTaken(less) : 0;
  const lockIn: Item | null = taken > 0
    ? { key: 'lock-in', text: hidden ? 'Перерасход зашёл в сбережения' : `Перерасход зашёл в сбережения: −${money(taken)}` }
    : null;
  // past 🔒 already: "До отложенного осталось …" would say otherwise
  const rest = lockIn ? spent.filter((i) => i.key !== 'lock-near') : spent;
  const items = lockIn ? [lockIn, ...rest] : rest;
  // ✕ hides what is shown now; something new brings it back
  const key = `${ym}:${items.map((i) => i.key).join(',')}`;
  const shown = dismissed !== undefined && items.length > 0 && dismissed !== key;

  return (
    <>
      {shown ? (
        <View style={styles.box} accessibilityRole="alert">
          <View style={styles.body}>
            {lockIn ? (
              <TouchableOpacity onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Перерасход: подробнее">
                <Text style={styles.text}>{`⚠ ${lockIn.text}`}<Text style={styles.more}>{' · Подробнее ›'}</Text></Text>
              </TouchableOpacity>
            ) : null}
            {rest.length ? <Text style={styles.text}>{`${lockIn ? '' : '⚠ '}${rest.map((i) => i.text).join('\n')}`}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => { setDismissed(key); setSetting(DISMISSED_KEY, key).catch(toastFailure('save alert dismissal', SAVE_FAILED)); }}
            hitSlop={10}
            accessibilityLabel="Скрыть предупреждение"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <SavingsLessSheet less={less} visible={sheet} money={money} onClose={() => setSheet(false)} onOpen={(id) => setPlanTarget(lessTarget(view, id))} />
      <PlanAmountModal ym={ym} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.warnBg,
  },
  body: { flex: 1, gap: 4 },
  text: { fontSize: 14, color: colors.warn },
  more: { fontWeight: '600' },
  close: { fontSize: 16, color: colors.warn },
});
