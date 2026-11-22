import React from 'react';
import { Text, View } from 'react-native';
import { formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import type { ReportView } from '../model/reportView';
import { FromLine, YearInfo } from './Lines';
import PlanFact from './PlanFact';
import { styles } from './styles';

/** «Пришло · План · Потрачено» of the month, side by side. */
function MonthNumbers({ v }: { v: ReportView }) {
  const { r, money } = v;
  const cells: Array<[string, number]> = [...(r.income > 0 ? [['Пришло', r.income] as [string, number]] : []), ['План', r.planned], ['Потрачено', r.spent]];
  return (
    <View style={styles.numbers}>
      {cells.map(([label, value]) => (
        <View key={label} style={styles.numberCell}>
          <Text style={styles.numberLabel}>{label}</Text>
          <Masked style={styles.numberValue}>{money(value)}</Masked>
        </View>
      ))}
    </View>
  );
}

/**
 * What was put aside and that a year, against the month before, where it came from; or the budget's overspend. A month
 * over: its savings and funds, planned and put aside (PlanFact) — closed, the put-aside one on top.
 */
export default function ReportHero({ v, onCloseMonth }: { v: ReportView; onCloseMonth: () => void }) {
  const { r, money } = v;
  const pf = r.planFact;
  const fact = pf?.fact ?? null;
  if (r.saved === null) {
    return <Text style={styles.hint}>Бюджет месяца не задан: потрачено {money(r.spent)}. Задайте бюджет в плане, чтобы видеть, сколько откладывается.</Text>;
  }
  if (r.saved < 0) {
    return (
      <View style={styles.hero}>
        <Text style={styles.caption}>Бюджет превышен на</Text>
        <Text style={[styles.heroValue, styles.over]}>
          {money(-r.saved)}
          {r.overInBudget ? <Text style={styles.heroAside}>{` (${formatWithCurrency(Math.round(r.overInBudget.minor), r.overInBudget.currency)})`}</Text> : null}
        </Text>
        <Text style={styles.caption}>Потрачено {money(r.spent)} при бюджете {money(r.budget!)}</Text>
        <MonthNumbers v={v} />
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <Text style={styles.caption}>{fact !== null || !r.toSavings ? 'Отложено' : 'В сбережения'}</Text>
      <Masked style={styles.heroValue}>{v.savedMoney(fact ?? r.saved)}</Masked>
      {fact !== null ? (
        <Text style={styles.caption}>
          по плану <Masked style={styles.caption}>{v.savedMoney(pf!.plan)}</Masked> · ≈ <Masked style={styles.caption}>{v.savedPerYear(fact)}</Masked> за год в таком темпе
        </Text>
      ) : r.average ? (
        <YearInfo info={v.averageInfo()}>
          ≈ <Masked style={styles.caption}>{v.savedPerYear(r.average.saved)}</Masked> за год
          {r.average.months.length > 1 ? ` · в среднем за ${r.average.months.length} мес.` : ' в таком темпе'}
        </YearInfo>
      ) : null}
      {v.ofBudget ? <Text style={styles.caption}>{v.ofBudget}</Text> : null}
      {v.ofIncome ? <Text style={styles.caption}>{v.ofIncome}</Text> : null}
      {r.previousSaved !== null && Math.round(r.saved) !== Math.round(r.previousSaved) ? (
        <Text style={[styles.caption, r.saved > r.previousSaved ? styles.good : styles.over]}>
          На {v.savedMoney(Math.abs(r.saved - r.previousSaved))} {r.saved > r.previousSaved ? 'больше' : 'меньше'}, чем месяцем раньше
        </Text>
      ) : null}
      <MonthNumbers v={v} />
      {pf ? <PlanFact v={v} pf={pf} onCloseMonth={onCloseMonth} /> : null}
      {/* where it comes from: the parts add up to it */}
      {r.savedFrom && !pf ? (
        <View style={styles.from}>
          {r.savedFrom.locked > 0 ? <FromLine label="🔒 Отложено сразу" v={r.savedFrom.locked} money={money} /> : null}
          {/* not distributed is money the plan left without a purpose: worth planning, so red */}
          <FromLine label="Свободно в плане" v={r.savedFrom.undistributed} money={money} bad />
          <FromLine label={r.savedFrom.plan >= 0 ? 'Категории плана потратили меньше' : 'Категории плана потратили больше'} v={r.savedFrom.plan} money={money} />
          {r.unplannedShare > 0 || r.savedFrom.unplanned !== 0 ? (
            <FromLine label={r.savedFrom.unplanned >= 0 ? 'Не потрачено из доли вне плана' : 'Вне плана сверх доли'} v={r.savedFrom.unplanned} money={money} info={v.unplannedInfo} />
          ) : null}
          {r.savedFrom.funds > 0 ? <FromLine label="Взносы в копилки" v={r.savedFrom.funds} money={money} /> : null}
        </View>
      ) : null}
    </View>
  );
}
