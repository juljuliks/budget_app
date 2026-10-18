import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SavingsPlanFact } from '@/db/reportSavings';
import { MONTHS_NOM } from '@/shared/lib/dates';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { ReportView } from '../model/reportView';
import { styles as report } from './styles';

/** `onCloseMonth`: "Подвести итоги ›" — the report closes, the month's "Итоги" open */
type Props = { v: ReportView; pf: SavingsPlanFact; onCloseMonth: () => void };

/** A row: the name, its plan, its fact ("—" until the month's "Итоги"); the fact red when less than planned. */
function Row({ name, plan, fact, money, sub, strong }: {
  name: string; plan: number; fact?: number | null; money: (v: number) => string; sub?: boolean; strong?: boolean;
}) {
  const less = fact != null && fact < plan;
  return (
    <View style={styles.row}>
      <Text style={[styles.name, sub && styles.sub, strong && styles.strong]} numberOfLines={2}>{name}</Text>
      <Masked style={[styles.num, sub ? styles.subNum : styles.plan, strong && styles.strong]}>{money(plan)}</Masked>
      {sub ? <Text style={styles.num} /> : (
        <Masked style={[styles.num, strong && styles.strong, fact == null ? report.muted : less ? report.bad : report.good]}>
          {fact == null ? '—' : money(fact)}
        </Masked>
      )}
    </View>
  );
}

/**
 * The month's savings and funds, planned and put aside, as its "Итоги месяца" said: 🔒 "Отложено сразу", 💰 "Сэкономлено" (with
 * what it was made of), each fund's contribution, the total. The leftover moved or kept as is: a line apart. Not closed:
 * the plan, "Итоги не подведены" and "Подвести итоги ›".
 */
export default function PlanFact({ v, pf, onCloseMonth }: Props) {
  const { r, money } = v;
  const f = r.savedFrom;
  const restIn = pf.rest && (pf.rest.choice === null || pf.rest.choice === 'savings');
  const next = MONTHS_NOM[(Number(r.ym.slice(5))) % 12];
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={styles.name} />
        <Text style={[styles.num, styles.head]}>План</Text>
        <Text style={[styles.num, styles.head]}>Факт</Text>
      </View>
      {pf.locked ? <Row name="🔒 Отложено сразу" plan={pf.locked.plan} fact={pf.locked.fact} money={money} /> : null}
      {restIn ? (
        <>
          <Row name="💰 Сэкономлено" plan={pf.rest!.plan} fact={pf.rest!.fact} money={money} />
          {f ? (
            <>
              <Row sub name="Свободно в плане" plan={f.undistributed} money={money} />
              <Row sub name={f.plan >= 0 ? 'Категории плана потратили меньше' : 'Категории плана потратили больше'} plan={f.plan} money={money} />
              {r.unplannedShare > 0 || f.unplanned !== 0 ? (
                <Row sub name={f.unplanned >= 0 ? 'Не потрачено из доли вне плана' : 'Вне плана сверх доли'} plan={f.unplanned} money={money} />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {pf.funds.map((x) => <Row key={x.category_id} name={`${`${x.emoji ?? ''} ${x.name}`.trim()} · взнос`} plan={x.plan} fact={x.fact} money={money} />)}
      <View style={styles.rule} />
      <Row strong name="Всего" plan={pf.plan} fact={pf.fact} money={money} />
      {pf.rest && !restIn ? (
        <View style={styles.apart}>
          <Text style={styles.name}>{pf.rest.choice === 'next' ? `💰 Сэкономлено — перенесено на ${next}` : '💰 Сэкономлено — оставлено как есть, не отложено'}</Text>
          <Masked style={styles.num}>{money(pf.rest.plan)}</Masked>
        </View>
      ) : null}
      {!pf.closed ? (
        <View style={styles.open}>
          <Text style={styles.openText}>Итоги не подведены: факт появится, когда ответите, что удалось отложить</Text>
          <TouchableOpacity onPress={onCloseMonth} hitSlop={6} accessibilityRole="button">
            <Text style={report.link}>Подвести итоги ›</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', marginTop: 10, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, color: colors.text },
  num: { width: 92, textAlign: 'right', fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  head: { fontSize: 12, fontWeight: '500', color: colors.muted },
  plan: { color: colors.muted },
  sub: { fontSize: 12, color: colors.muted, paddingLeft: 12 },
  subNum: { fontSize: 12, color: colors.muted },
  strong: { fontWeight: '600', color: colors.text },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  apart: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  open: { marginTop: 8, gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.warnBg },
  openText: { fontSize: 14, color: colors.warn },
});
