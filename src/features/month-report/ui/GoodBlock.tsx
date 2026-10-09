import React from 'react';
import { Text, View } from 'react-native';
import type { ReportView } from '../model/reportView';
import { CategoryLine, Line, YearInfo } from './Lines';
import { styles } from './styles';

/** What is already good: every amount with a plus, what it gives a year in the header. */
export default function GoodBlock({ v }: { v: ReportView }) {
  const { r, money, plus, perYear } = v;
  return (
    <View style={[styles.block, styles.goodBlock]}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>Что уже хорошо</Text>
        {v.goodMonth > 0 ? (
          <YearInfo style={[styles.blockValue, styles.good]} info={v.yearInfo(v.goodParts, '+', 'Столько это даст за год, если так будет каждый месяц.')}>
            ≈ +{perYear(v.goodMonth)} в год
          </YearInfo>
        ) : null}
      </View>
      {r.locked > 0 && r.lockedTouched === 0 ? <Line label={`✓ Отложенное не тронуто: 🔒 ${money(r.locked)}`} /> : null}
      {r.overLimits.length === 0 && r.saved !== null ? <Line label="✓ Лимиты категорий соблюдены" /> : null}
      {r.unplannedSpent > 0 && r.unplannedOver === 0 && !r.review ? (
        <Line label={`✓ Вне плана в пределах доли: ${money(r.unplannedSpent)} из ${money(r.unplannedShare)}`} />
      ) : null}
      {r.savedInPlan > 0 ? (
        <>
          <Line label="Сэкономлено в плане" value={plus(r.savedInPlan)} strong valueStyle={styles.good} />
          {r.underPlan.map((c) => (
            <CategoryLine key={String(c.id)} c={c} note={`план ${money(c.limit)}, факт ${money(c.spent)}`} value={plus(c.limit - c.spent)} valueStyle={styles.good} />
          ))}
        </>
      ) : null}
      {r.movedToSavings > 0 ? <Line label="Переведено в «Сбережения» вручную" value={plus(r.movedToSavings)} strong valueStyle={styles.good} /> : null}
      {v.better > 0 ? <Line label="Отложено больше, чем месяцем раньше" value={plus(v.better)} strong valueStyle={styles.good} /> : null}
    </View>
  );
}
