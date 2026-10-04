import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, monthStats, parseYm, periodStats, PeriodStats, PlanKind } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import BottomSheet from '../BottomSheet';
import { DayRange, daysByMonth, daysInMonth, rangeDays, rangeToUnix } from '../dateRange';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import Meter from '../Meter';
import { formatShort } from '../money';
import { plural } from '../format';
import { colors, meterColor } from '../theme';
import { DonutCenter } from './StatsView';

/** Periods up to this long are measured against the plan (its share for these days); longer ones aren't. */
const PACE_MAX_DAYS = 31;

type Props = {
  range: DayRange;
  /** "на день" / "на неделю" / "на период" */
  normLabel: string;
  emptyText?: string;
};

/** The plan's share for the days of a period: each day gets its month's plan / days in that month. */
type Norms = {
  /** the flexible categories' norm (fixed payments come in one go and aren't split by days) */
  total: number;
  byCategory: Map<number, { norm: number; kind: PlanKind; monthLimit: number }>;
};

/** "12%", "<1%" for a tiny non-zero share. */
function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

async function loadNorms(range: DayRange, currency: Parameters<typeof monthStats>[2]): Promise<Norms> {
  const months = daysByMonth(range);
  const norms: Norms = { total: 0, byCategory: new Map() };
  for (const [ym, days] of months) {
    const { year, month } = parseYm(ym);
    const m = await monthStats(year, month, currency);
    const share = days / daysInMonth(ym);
    for (const c of m.categories) {
      if (c.category_id === null || !c.limit_minor) continue;
      const cur = norms.byCategory.get(c.category_id) ?? { norm: 0, kind: c.plan_kind ?? 'limit', monthLimit: 0 };
      cur.norm += c.limit_minor * share;
      if ((c.plan_kind ?? 'limit') === 'limit') norms.total += c.limit_minor * share;
      // one month's plan: for a week across two months, the month it ends in (the later one overwrites)
      cur.monthLimit = c.limit_minor;
      norms.byCategory.set(c.category_id, cur);
    }
  }
  return norms;
}

/**
 * Spending of a period by category, with a donut. A short period (a day, a week, up to a month) is measured
 * against the plan's norm for these days: are we on pace? A long one (a year) shows the structure and the
 * average per month.
 */
export default function PeriodStatsView({ range, normLabel, emptyText = 'За этот период трат нет.' }: Props) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [norms, setNorms] = useState<Norms | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  // a long period: the average over its full months with data (undefined = loading, null = none yet)
  const [average, setAverage] = useState<{ average_minor: number; months: number } | null | undefined>(undefined);
  // the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();
  const days = rangeDays(range);
  const pace = days <= PACE_MAX_DAYS;

  const load = useCallback(() => {
    const { from, to } = rangeToUnix(range);
    periodStats(from, to, currency).then(setStats).catch((e) => console.error('load period stats failed', e));
    if (pace) loadNorms(range, currency).then(setNorms).catch((e) => console.error('load norms failed', e));
    else setNorms(null);
    if (!pace) averageFullMonths(range.from, range.to, currency).then(setAverage).catch((e) => console.error('load average failed', e));
  }, [range, currency, pace]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  const cur = stats.currency;
  // spending of the flexible categories, compared with their norm under the donut
  const flexSpent = stats.categories.reduce((sum, c) => {
    const p = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
    return p && p.kind === 'limit' ? sum + c.spent_minor : sum;
  }, 0);

  // under the donut: the pace against the whole plan, or the average per month for a long period
  const summary = pace
    ? (norms && norms.total > 0
      ? `Гибкие траты: ${formatShort(flexSpent)} из нормы ${formatShort(Math.round(norms.total))} ${cur} ${normLabel} (${pct(flexSpent, norms.total)})`
      : 'Плана на эти дни нет — показана только структура трат.')
    : average === undefined ? ''
      : average === null ? 'Для среднего в месяц нужен хотя бы один полный месяц с данными.'
        : `В среднем ${formatShort(average.average_minor)} ${cur} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={cur} />
        </Donut>
      </View>
      <TouchableOpacity style={styles.summaryRow} onPress={() => setInfoOpen(true)} accessibilityLabel="Как считается">
        <Text style={styles.summary}>{summary}</Text>
        <InfoIcon color={colors.accent} />
      </TouchableOpacity>

      {stats.categories.length === 0 ? <Text style={styles.hint}>{emptyText}</Text> : null}
      {stats.groups.map((g) => (
        <View key={`${g.type_id}-${g.title}`} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <Text style={styles.groupTotal}>{formatShort(g.spent_minor)}</Text>
          </View>
          {g.categories.map((c) => {
            const plan = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
            return (
              <View key={String(c.category_id)} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                  <Text style={styles.amount}>{formatShort(c.spent_minor)} {cur}</Text>
                </View>
                {plan ? (
                  // the period against the category's month: how much of its month's spending and of its plan
                  // this is (no "norm" per category: one purchase a month is fine as long as the month fits)
                  <>
                    <Meter ratio={plan.monthLimit > 0 ? c.spent_minor / plan.monthLimit : 0} height={8} color={c.color} />
                    <Text style={styles.share}>
                      {pct(c.spent_minor, stats.spent_minor)} всех трат за период
                      {' · '}{pct(c.spent_minor, plan.monthLimit)} плана на месяц
                    </Text>
                    {/* the category's plan per day × days of the period (fixed payments aren't split by days) */}
                    {plan.kind === 'limit' ? (
                      // colored like the month's bars: green on pace, amber close to the plan, red over it
                      <Text style={[styles.share, styles.pace, { color: meterColor(plan.norm > 0 ? c.spent_minor / plan.norm : 0) }]}>
                        {pct(c.spent_minor, plan.norm)} от плана {normLabel} ({formatShort(Math.round(plan.norm))} {cur})
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.share}>{pct(c.spent_minor, stats.spent_minor)} всех трат за период</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          Не учтено, нет курса (нужен интернет): {stats.other_currencies.map((o) => `${formatShort(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Как считается">
        <View style={styles.info}>
          {pace ? (
            <>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Норма</Text> — часть месячного плана, приходящаяся на эти дни: план месяца
                делится на число дней в нём и умножается на дни периода. Например, при плане 800 {cur} на октябрь норма на
                неделю — 800 × 7 / 31 ≈ 181 {cur}. Неделя на стыке месяцев считается по планам обоих месяцев.
              </Text>
              <Text style={styles.infoText}>
                Строка под диаграммой — <Text style={styles.infoBold}>гибкие траты</Text> (еда, бары) за период против
                их нормы. Можно где-то потратить больше, где-то меньше — важно, укладываетесь ли вы в сумме. Фиксированные
                траты (аренда, подписки) приходят одним платежом и в норму не входят.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Категория с планом:</Text> полоска — какая часть плана категории на месяц
                ушла за этот период. Под ней — доля категории во всех тратах за период и доля от её плана на месяц.
                Ниже — сколько потрачено от плана гибкой категории на эти дни (план на месяц / дни месяца × дни периода): зелёный — в рамках, жёлтый — близко, красный — больше плана.
                Купили одежду один раз на 60% плана — вы в рамках, перерасхода нет. Если период захватывает два
                месяца, берётся план месяца, в котором период заканчивается.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Без плана</Text> — только сумма и доля от всех трат за период.
              </Text>
            </>
          ) : (
            <Text style={styles.infoText}>
              Период длиннее месяца с планом не сравнивается: показана структура трат по категориям и среднее в месяц.
              Среднее считается только по полным месяцам с данными: текущий месяц ещё не закончился, а первый не
              учитывается, если учёт начался не с 1-го числа. Так аренда в начале месяца и дни до установки
              приложения не искажают цифру.
            </Text>
          )}
          <Text style={styles.infoText}>Все суммы — в валюте из настроек, по курсу на день каждой траты.</Text>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  summary: { flexShrink: 1, fontSize: 14, color: colors.text, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border,
  },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  pace: { fontWeight: '600' },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  info: { paddingHorizontal: 20, gap: 10 },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  infoBold: { fontWeight: '600' },
});
