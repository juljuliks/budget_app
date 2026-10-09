import React from 'react';
import { Text, View } from 'react-native';
import Masked from '@/shared/ui/Masked';
import type { ReportView } from '../model/reportView';
import { FromLine, YearInfo } from './Lines';
import { styles } from './styles';

/** What was put aside and that a year, against the month before, where it came from; or the budget's overspend. */
export default function ReportHero({ v }: { v: ReportView }) {
  const { r, money, perYear } = v;
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
      <Text style={styles.caption}>{r.toSavings ? 'В сбережения' : 'Отложено'}</Text>
      <Masked style={styles.heroValue}>{money(r.saved)}</Masked>
      {r.average ? (
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
      {/* where it comes from: the three parts add up to it */}
      {r.savedFrom ? (
        <View style={styles.from}>
          {r.savedFrom.locked > 0 ? <FromLine label="🔒 Сразу" v={r.savedFrom.locked} money={money} /> : null}
          {/* not distributed is money the plan left without a purpose: worth planning, so red */}
          <FromLine label="Свободно в плане" v={r.savedFrom.undistributed} money={money} bad />
          <FromLine label={r.savedFrom.plan >= 0 ? 'Категории плана потратили меньше' : 'Категории плана потратили больше'} v={r.savedFrom.plan} money={money} />
          {r.unplannedShare > 0 || r.savedFrom.unplanned !== 0 ? (
            <FromLine label={r.savedFrom.unplanned >= 0 ? 'Не потрачено из доли вне плана' : 'Вне плана сверх доли'} v={r.savedFrom.unplanned} money={money} info={v.unplannedInfo} />
          ) : null}
          {r.movedToSavings > 0 ? <FromLine label="Из них переведено в «Сбережения» вручную" v={r.movedToSavings} money={money} /> : null}
        </View>
      ) : null}
    </View>
  );
}
