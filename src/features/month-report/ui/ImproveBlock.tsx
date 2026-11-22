import React from 'react';
import { Text, View } from 'react-native';
import type { ReportView } from '../model/reportView';
import { CategoryLine, Line, YearInfo } from './Lines';
import ReportBlock from './ReportBlock';
import { styles } from './styles';

/** «План / сверх»: the plan's part blue, past it orange. */
function PlanOverBar({ plan, spent }: { plan: number; spent: number }) {
  const ratio = spent > 0 ? Math.min(1, plan / spent) : 1;
  return (
    <View style={styles.overBar}>
      <View style={[styles.overPlan, { flex: ratio }]} />
      <View style={[styles.overPast, { flex: 1 - ratio }]} />
    </View>
  );
}

/** What to improve: the limits overspent (each — plan / past it), the block's cost a year in its header. */
export default function ImproveBlock({ v, page }: { v: ReportView; page?: boolean }) {
  const { r, money, minus, perYear } = v;
  return (
    <ReportBlock page={page} title="Что можно улучшить" right={v.badMonth > 0 ? (
      <YearInfo style={[styles.blockValue, styles.over]} info={v.yearInfo(v.badParts, '−', 'Столько не получится отложить за год, если так будет каждый месяц.')}>
        ≈ −{perYear(v.badMonth)} в год
      </YearInfo>
    ) : null}>
      {r.overLimitsTotal > 0 ? (
        <>
          <Line label="Перерасход лимитов" value={minus(r.overLimitsTotal)} strong valueStyle={styles.bad} />
          {r.overLimits.map((c) => (
            <View key={String(c.id)}>
              <CategoryLine c={c} note={`план ${money(c.limit)}, факт ${money(c.spent)}`} value={minus(c.spent - c.limit)} valueStyle={styles.bad} />
              <PlanOverBar plan={c.limit} spent={c.spent} />
            </View>
          ))}
          <Text style={styles.blockCaption}>Синим — план, оранжевым — сверх плана.</Text>
        </>
      ) : null}
    </ReportBlock>
  );
}
