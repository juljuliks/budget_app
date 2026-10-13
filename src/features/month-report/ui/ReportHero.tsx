import React from 'react';
import { Text, View } from 'react-native';
import Masked from '@/shared/ui/Masked';
import type { ReportView } from '../model/reportView';
import { FromLine, YearInfo } from './Lines';
import PlanFact from './PlanFact';
import { styles } from './styles';

/**
 * What was put aside and that a year, against the month before, where it came from; or the budget's overspend. A month
 * over: its savings and funds, planned and put aside (PlanFact) — closed, the put-aside one on top.
 */
export default function ReportHero({ v, onCloseMonth }: { v: ReportView; onCloseMonth: () => void }) {
  const { r, money, perYear } = v;
  const pf = r.planFact;
  const fact = pf?.fact ?? null;
  if (r.saved === null) {
    return <Text style={styles.hint}>Бюджет месяца не задан: потрачено {money(r.spent)}. Задайте бюджет в плане, чтобы видеть, сколько откладывается.</Text>;
  }
  if (r.saved < 0) {
    return (
      <View style={styles.hero}>
        <Text style={styles.caption}>Бюджет превышен на</Text>
        <Text style={[styles.heroValue, styles.over]}>{money(-r.saved)}</Text>
        <Text style={styles.caption}>Потрачено {money(r.spent)} при бюджете {money(r.budget!)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <Text style={styles.caption}>{fact !== null || !r.toSavings ? 'Отложено' : 'В сбережения'}</Text>
      <Masked style={styles.heroValue}>{money(fact ?? r.saved)}</Masked>
      {fact !== null ? (
        <Text style={styles.caption}>
          по плану <Masked style={styles.caption}>{money(pf!.plan)}</Masked> · ≈ <Masked style={styles.caption}>{perYear(fact)}</Masked> за год в таком темпе
        </Text>
      ) : r.average ? (
        <YearInfo info={v.averageInfo()}>
          ≈ <Masked style={styles.caption}>{perYear(r.average.saved)}</Masked> за год
          {r.average.months.length > 1 ? ` · в среднем за ${r.average.months.length} мес.` : ' в таком темпе'}
        </YearInfo>
      ) : null}
      {r.previousSaved !== null && Math.round(r.saved) !== Math.round(r.previousSaved) ? (
        <Text style={[styles.caption, r.saved > r.previousSaved ? styles.good : styles.over]}>
          На {money(Math.abs(r.saved - r.previousSaved))} {r.saved > r.previousSaved ? 'больше' : 'меньше'}, чем месяцем раньше
        </Text>
      ) : null}
      {pf ? <PlanFact v={v} pf={pf} onCloseMonth={onCloseMonth} /> : null}
      {pf && r.movedToSavings > 0 ? (
        <View style={styles.from}><FromLine label="Из них переведено в «Сбережения» вручную" v={r.movedToSavings} money={money} /></View>
      ) : null}
      {/* where it comes from: the parts add up to it */}
      {r.savedFrom && !pf ? (
        <View style={styles.from}>
          {r.savedFrom.locked > 0 ? <FromLine label="🔒 Сразу" v={r.savedFrom.locked} money={money} /> : null}
          {/* not distributed is money the plan left without a purpose: worth planning, so red */}
          <FromLine label="Свободно в плане" v={r.savedFrom.undistributed} money={money} bad />
          <FromLine label={r.savedFrom.plan >= 0 ? 'Категории плана потратили меньше' : 'Категории плана потратили больше'} v={r.savedFrom.plan} money={money} />
          {r.unplannedShare > 0 || r.savedFrom.unplanned !== 0 ? (
            <FromLine label={r.savedFrom.unplanned >= 0 ? 'Не потрачено из доли вне плана' : 'Вне плана сверх доли'} v={r.savedFrom.unplanned} money={money} info={v.unplannedInfo} />
          ) : null}
          {r.savedFrom.funds > 0 ? <FromLine label="Взносы в копилки" v={r.savedFrom.funds} money={money} /> : null}
          {r.movedToSavings > 0 ? <FromLine label="Из них переведено в «Сбережения» вручную" v={r.movedToSavings} money={money} /> : null}
        </View>
      ) : null}
    </View>
  );
}
