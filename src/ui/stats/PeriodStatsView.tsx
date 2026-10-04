import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, monthStats, NormPeriod, parseYm, periodStats, PeriodStats, PlanKind } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import BottomSheet from '../BottomSheet';
import Button from '../Button';
import { DayRange, daysInMonth, normWindow, rangeDays, rangeToUnix } from '../dateRange';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import Meter from '../Meter';
import { currencySymbol, formatWithCurrency } from '../money';
import { plural } from '../format';
import { colors } from '../theme';
import { DonutCenter } from './StatsView';

/** Periods up to this long are measured against the plan (its share for these days); longer ones aren't. */
const PACE_MAX_DAYS = 31;

type Props = {
  range: DayRange;
  /** "на день" / "на неделю" / "на период" */
  normLabel: string;
  emptyText?: string;
};

/**
 * Norms for a period, always within one month: the month the period ends in. A week across two months is cut at
 * the 1st (to look at the previous month, pick a period in it). Each day gets the month's plan / days in the month.
 */
type Norms = {
  /** the period's part in its last month: what the norms are about */
  range: DayRange;
  /** the flexible categories' norm for that part (fixed and month-rhythm ones aren't split by days) */
  total: number;
  /** their spending in that part */
  flexSpent: number;
  byCategory: Map<number, {
    kind: PlanKind; monthLimit: number;
    /** spending in the period's part in this month (for the share of the month's plan) */
    spent: number;
    /** the norm checked over the category's own rhythm window (see normWindow), cut to the month */
    rhythm: NormPeriod; window: DayRange; windowNorm: number; windowSpent: number;
  }>;
  /** spending from the 1st of the month up to the period's end: can a period's overspend still fit the month? */
  monthToDate: Map<number | null, number>;
};

const MONTHS_IN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** "12%", "<1%" for a tiny non-zero share. */
function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

async function loadNorms(range: DayRange, currency: Parameters<typeof monthStats>[2]): Promise<Norms> {
  const ym = range.to.slice(0, 7);
  const monthStart = `${ym}-01`;
  const dim = daysInMonth(ym);
  const clip = (r: DayRange): DayRange => ({ from: r.from > monthStart ? r.from : monthStart, to: r.to });
  const part = clip(range);
  const spentIn = async (r: DayRange) => {
    const u = rangeToUnix(r);
    return new Map((await periodStats(u.from, u.to, currency)).categories.map((c) => [c.category_id, c.spent_minor]));
  };
  const { year, month } = parseYm(ym);
  const m = await monthStats(year, month, currency);
  const partSpent = await spentIn(part);
  const norms: Norms = {
    range: part, total: 0, flexSpent: 0, byCategory: new Map(),
    monthToDate: await spentIn({ from: monthStart, to: range.to }),
  };
  const windows = new Map<string, Map<number | null, number>>();
  for (const c of m.categories) {
    if (c.category_id === null || !c.limit_minor) continue;
    const kind = c.plan_kind ?? 'limit';
    const rhythm = c.plan_norm ?? 'day';
    const spent = partSpent.get(c.category_id) ?? 0;
    // the overall pace under the donut: per day, without fixed and month-rhythm categories (one-off buys)
    if (kind === 'limit' && rhythm !== 'month') {
      norms.total += (c.limit_minor * rangeDays(part)) / dim;
      norms.flexSpent += spent;
    }
    const win = clip(normWindow(rhythm, part));
    const key = `${win.from}|${win.to}`;
    if (!windows.has(key)) windows.set(key, await spentIn(win));
    norms.byCategory.set(c.category_id, {
      kind, monthLimit: c.limit_minor, spent, rhythm, window: win,
      windowNorm: rhythm === 'month' ? c.limit_minor : (c.limit_minor * rangeDays(win)) / dim,
      windowSpent: windows.get(key)!.get(c.category_id) ?? 0,
    });
  }
  return norms;
}

type Pace = 'ok' | 'ahead' | 'over';

/**
 * ok: within the plan for these days. ahead: over it, but the month so far still fits the month's plan (can be
 * made up later). over: the month's plan is already exceeded.
 */
function paceOf(spent: number, norm: number, monthToDate: number, monthLimit: number): Pace {
  if (spent <= norm) return 'ok';
  return monthToDate <= monthLimit ? 'ahead' : 'over';
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
  const sym = currencySymbol(cur);
  const money = (minor: number) => formatWithCurrency(minor, cur);
  // spending of the flexible categories, compared with their norm under the donut
  const flexSpent = norms?.flexSpent ?? 0;
  const summaryLabel = normLabel;

  // under the donut: the pace against the whole plan, or the average per month for a long period
  const summary = pace
    ? (norms && norms.total > 0
      ? `Гибкие траты: ${money(flexSpent)} из нормы ${money(Math.round(norms.total))} ${summaryLabel} (${pct(flexSpent, norms.total)})`
      : 'Плана на эти дни нет — показана только структура трат.')
    : average === undefined ? ''
      : average === null ? 'Для среднего в месяц нужен хотя бы один полный месяц с данными.'
        : `В среднем ${money(average.average_minor)} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;

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
            <Text style={styles.groupTotal}>{money(g.spent_minor)}</Text>
          </View>
          {g.categories.map((c) => {
            const plan = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
            return (
              <View key={String(c.category_id)} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                  <Text style={styles.amount}>{money(c.spent_minor)}</Text>
                </View>
                {plan ? (
                  // the period against the category's month: how much of its month's spending and of its plan
                  // this is (no "norm" per category: one purchase a month is fine as long as the month fits)
                  <>
                    {/* the share of the month's plan (a period across months: its part in the last month) */}
                    <Meter ratio={plan.monthLimit > 0 ? plan.spent / plan.monthLimit : 0} height={8} color={c.color} />
                    <Text style={styles.share}>
                      {pct(c.spent_minor, stats.spent_minor)} всех трат за период · {pct(plan.spent, plan.monthLimit)} плана на {MONTHS_IN[parseYm(plan.window.to).month]}
                    </Text>
                    {/* the category's norm over its own rhythm window (fixed payments aren't split by days) */}
                    {plan.kind === 'limit' ? (() => {
                      const p = paceOf(plan.windowSpent, plan.windowNorm, norms?.monthToDate.get(c.category_id) ?? 0, plan.monthLimit);
                      const sameWindow = plan.window.from === range.from && plan.window.to === range.to;
                      // by the rhythm, without dates: the window is the week / two weeks / month around the period, within its month
                      const label = sameWindow ? normLabel
                        : plan.rhythm === 'month' ? `на ${MONTHS_IN[parseYm(plan.window.to).month]}`
                          : plan.rhythm === 'week' ? 'на неделю' : 'на 2 недели';
                      return (
                        <TouchableOpacity style={styles.paceRow} onPress={() => setInfoOpen(true)} accessibilityLabel="Что значит цвет">
                          <Text style={[styles.share, styles.pace, p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver]}>
                            {sameWindow ? '' : `${money(plan.windowSpent)} · `}
                            {pct(plan.windowSpent, plan.windowNorm)} от плана {label} ({money(Math.round(plan.windowNorm))})
                          </Text>
                          <InfoIcon color={colors.muted} size={15} />
                        </TouchableOpacity>
                      );
                    })() : null}
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
          Не учтено, нет курса (нужен интернет): {stats.other_currencies.map((o) => formatWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Как считается" style={styles.infoSheet}>
        {/* the text scrolls, "Понятно" stays at the bottom */}
        <ScrollView style={styles.infoScroll} contentContainerStyle={styles.info}>
          {pace ? (
            <>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Норма</Text> — часть месячного плана, приходящаяся на эти дни: план месяца
                делится на число дней в нём и умножается на дни периода. Например, при плане 800 {sym} на октябрь норма на
                неделю — 800 × 7 / 31 ≈ 181 {sym}. Нормы всегда считаются внутри одного месяца — того, в котором заканчивается период: неделя на стыке
                месяцев обрезается по 1-е число. Чтобы посмотреть прошлый месяц, выберите период в нём.
              </Text>
              <Text style={styles.infoText}>
                Строка под диаграммой — общий темп <Text style={styles.infoBold}>гибких трат</Text> по дням: где-то
                больше, где-то меньше — важно, укладываетесь ли вы в сумме. Фиксированные траты (аренда, подписки) и
                категории с нормой «в месяц» (крупные разовые покупки) в неё не входят.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Категория с планом:</Text> полоска — какая часть плана категории на месяц
                ушла за этот период. Под ней — доля категории во всех тратах за период и доля от её плана на месяц.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Цветная строка</Text> — траты гибкой категории против её нормы. Норма
                считается в ритме, заданном в плане: в день (еда), в неделю (бары), за 2 недели или в месяц (одежда).
                Если период короче ритма, берётся неделя / 2 недели / месяц, куда он попадает, — например, для баров за
                день видно всю неделю: «73 {sym} · 61% от плана на неделю». Неделя на стыке месяцев считается только по дням
                текущего месяца, и норма для неё меньше: для 1–4 октября при плане 500 {sym} — 500 / 31 × 4 ≈ 64.5 {sym}.
              </Text>
              <Text style={styles.infoText}>
                <Text style={[styles.infoBold, styles.paceOk]}>Зелёный</Text> — за период потрачено не больше плана на эти дни.
              </Text>
              <Text style={styles.infoText}>
                <Text style={[styles.infoBold, styles.paceAhead]}>Оранжевый</Text> — за период больше плана на эти дни, но с
                начала месяца по категории потрачено не больше плана на месяц: перерасход можно отыграть в следующие дни.
              </Text>
              <Text style={styles.infoText}>
                <Text style={[styles.infoBold, styles.paceOver]}>Красный</Text> — с начала месяца по категории уже потрачено
                больше плана на месяц.
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
        </ScrollView>
        <Button title="Понятно" onPress={() => setInfoOpen(false)} style={styles.infoButton} />
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
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  paceOver: { color: colors.danger },
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  info: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  infoBold: { fontWeight: '600' },
  infoSheet: { maxHeight: '85%' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoButton: { marginTop: 12, marginHorizontal: 20 },
});
