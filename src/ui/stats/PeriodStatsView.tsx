import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, currentYm, monthStats, NormPeriod, parseYm, periodStats, PeriodStats, PlanKind, ymOf } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import BottomSheet from '../BottomSheet';
import Button from '../Button';
import { DayRange, daysByMonth, daysInMonth, normWindow, rangeDays, rangeToUnix, shortRange } from '../dateRange';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import Meter from '../Meter';
import { formatShort } from '../money';
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

/** The plan's share for the days of a period: each day gets its month's plan / days in that month. */
type Norms = {
  /** the flexible categories' norm (fixed payments come in one go and aren't split by days) */
  total: number;
  byCategory: Map<number, {
    norm: number; kind: PlanKind; monthLimit: number;
    /** the norm checked over the category's own rhythm window (see normWindow) */
    rhythm: NormPeriod; window: DayRange; windowNorm: number; windowSpent: number;
  }>;
  /**
   * Per month of the period (two for a week across months): the category's spending on those days and its plan
   * for that month, for "Сентябрь 100% · Октябрь 100%".
   */
  months: Array<{ ym: string; spent: Map<number | null, number>; limits: Map<number, number> }>;
  /** spending from the 1st of the month the period ends in up to its end: can a period's overspend still fit the month? */
  monthToDate: Map<number | null, number>;
};

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** "12%", "<1%" for a tiny non-zero share. */
function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

async function loadNorms(range: DayRange, currency: Parameters<typeof monthStats>[2]): Promise<Norms> {
  const months = daysByMonth(range);
  const norms: Norms = { total: 0, byCategory: new Map(), months: [], monthToDate: new Map() };

  // each month's plan amounts (converted), cached; plan months are never created from here (past or current only)
  const monthCache = new Map<string, Map<number, number>>();
  const thisYm = currentYm();
  const limitsOf = async (ym: string) => {
    if (!monthCache.has(ym)) {
      const { year, month } = parseYm(ym);
      const m = await monthStats(year, month, currency);
      monthCache.set(ym, new Map(m.categories.filter((c) => c.category_id !== null && c.limit_minor).map((c) => [c.category_id!, c.limit_minor!])));
    }
    return monthCache.get(ym)!;
  };
  /**
   * The category's plan for the month; a month without one (e.g. before planning started) borrows the nearest
   * month that has it, so its days don't count with a zero norm.
   */
  const limitFor = async (id: number, ym: string): Promise<number> => {
    const own = (await limitsOf(ym)).get(id);
    if (own) return own;
    const { year, month } = parseYm(ym);
    for (let d = 1; d <= 12; d++) {
      for (const candidate of [ymOf(year, month + d), ymOf(year, month - d)]) {
        if (candidate > thisYm) continue;
        const l = (await limitsOf(candidate)).get(id);
        if (l) return l;
      }
    }
    return 0;
  };

  for (const [ym] of months) {
    const { year, month } = parseYm(ym);
    const m = await monthStats(year, month, currency);
    // the period's days in this month and the spending on them
    const part: DayRange = {
      from: range.from > `${ym}-01` ? range.from : `${ym}-01`,
      to: range.to < `${ym}-${daysInMonth(ym)}` ? range.to : `${ym}-${daysInMonth(ym)}`,
    };
    const { from, to } = rangeToUnix(part);
    const spentPart = await periodStats(from, to, currency);
    norms.months.push({
      ym,
      spent: new Map(spentPart.categories.map((c) => [c.category_id, c.spent_minor])),
      limits: new Map(m.categories.filter((c) => c.category_id !== null && c.limit_minor).map((c) => [c.category_id!, c.limit_minor!])),
    });
    for (const c of m.categories) {
      if (c.category_id === null || !c.limit_minor) continue;
      const rhythm = c.plan_norm ?? 'day';
      const cur = norms.byCategory.get(c.category_id) ?? {
        norm: 0, kind: c.plan_kind ?? 'limit', monthLimit: 0, rhythm, window: range, windowNorm: 0, windowSpent: 0,
      };
      cur.kind = c.plan_kind ?? 'limit';
      cur.rhythm = rhythm;
      // one month's plan: for a week across two months, the month it ends in (the later one overwrites)
      cur.monthLimit = c.limit_minor;
      norms.byCategory.set(c.category_id, cur);
    }
  }
  // the norm for the period's days: each day gets its month's plan / days in that month
  for (const [id, cat] of norms.byCategory) {
    for (const [ym, days] of months) cat.norm += (await limitFor(id, ym)) * days / daysInMonth(ym);
    // the overall pace under the donut: per day, without the categories counted per month (big one-off buys)
    if (cat.kind === 'limit' && cat.rhythm !== 'month') norms.total += cat.norm;
  }
  const lastYm = [...months.keys()][months.size - 1];
  const mtd = rangeToUnix({ from: `${lastYm}-01`, to: range.to });
  norms.monthToDate = new Map((await periodStats(mtd.from, mtd.to, currency)).categories.map((c) => [c.category_id, c.spent_minor]));

  // each flexible category's rhythm window: its spending there and its norm (plan / days of month × days)
  const spentCache = new Map<string, Map<number | null, number>>();
  for (const [id, cat] of norms.byCategory) {
    if (cat.kind !== 'limit') continue;
    const win = normWindow(cat.rhythm, range);
    const key = `${win.from}|${win.to}`;
    if (!spentCache.has(key)) {
      const u = rangeToUnix(win);
      spentCache.set(key, new Map((await periodStats(u.from, u.to, currency)).categories.map((c) => [c.category_id, c.spent_minor])));
    }
    let norm = 0;
    if (cat.rhythm === 'month') norm = cat.monthLimit;
    else for (const [ym, d] of daysByMonth(win)) norm += (await limitFor(id, ym)) * d / daysInMonth(ym);
    cat.window = win;
    cat.windowNorm = norm;
    cat.windowSpent = spentCache.get(key)!.get(id) ?? 0;
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
  // spending of the flexible categories, compared with their norm under the donut
  const flexSpent = stats.categories.reduce((sum, c) => {
    const p = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
    return p && p.kind === 'limit' && p.rhythm !== 'month' ? sum + c.spent_minor : sum;
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
                    {/* the share of the month's plan; across two months, of the month the period ends in */}
                    <Meter ratio={(() => {
                      const last = norms && norms.months.length > 1 ? norms.months[norms.months.length - 1] : null;
                      const spent = last ? last.spent.get(c.category_id) ?? 0 : c.spent_minor;
                      return plan.monthLimit > 0 ? spent / plan.monthLimit : 0;
                    })()} height={8} color={c.color} />
                    <Text style={styles.share}>
                      {pct(c.spent_minor, stats.spent_minor)} всех трат за период
                      {' · '}{norms && norms.months.length > 1
                        // a week across two months: each month's part against that month's plan
                        ? norms.months.map((mo) => {
                          const lim = c.category_id === null ? undefined : mo.limits.get(c.category_id);
                          const name = MONTH_NAMES[parseYm(mo.ym).month];
                          return lim ? `${name} ${pct(mo.spent.get(c.category_id) ?? 0, lim)}` : `${name} без плана`;
                        }).join(' · ') + ' плана'
                        : `${pct(c.spent_minor, plan.monthLimit)} плана на месяц`}
                    </Text>
                    {/* the category's norm over its own rhythm window (fixed payments aren't split by days) */}
                    {plan.kind === 'limit' ? (() => {
                      const p = paceOf(plan.windowSpent, plan.windowNorm, norms?.monthToDate.get(c.category_id) ?? 0, plan.monthLimit);
                      const sameWindow = plan.window.from === range.from && plan.window.to === range.to;
                      const label = sameWindow ? normLabel
                        : plan.rhythm === 'month' ? `на месяц (с ${shortRange({ from: plan.window.from, to: plan.window.from })})`
                          : `${plan.rhythm === 'week' ? 'на неделю' : 'на 2 недели'} ${shortRange(plan.window)}`;
                      return (
                        <TouchableOpacity style={styles.paceRow} onPress={() => setInfoOpen(true)} accessibilityLabel="Что значит цвет">
                          <Text style={[styles.share, styles.pace, p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver]}>
                            {sameWindow ? '' : `${formatShort(plan.windowSpent)} · `}
                            {pct(plan.windowSpent, plan.windowNorm)} от плана {label} ({formatShort(Math.round(plan.windowNorm))} {cur})
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
          Не учтено, нет курса (нужен интернет): {stats.other_currencies.map((o) => `${formatShort(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Как считается" style={styles.infoSheet}>
        {/* the text scrolls, "Понятно" stays at the bottom */}
        <ScrollView style={styles.infoScroll} contentContainerStyle={styles.info}>
          {pace ? (
            <>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Норма</Text> — часть месячного плана, приходящаяся на эти дни: план месяца
                делится на число дней в нём и умножается на дни периода. Например, при плане 800 {cur} на октябрь норма на
                неделю — 800 × 7 / 31 ≈ 181 {cur}. Неделя на стыке месяцев считается по планам обоих месяцев; если в одном из них у категории плана нет (например, план начали вести позже), его дни берут план ближайшего месяца.
              </Text>
              <Text style={styles.infoText}>
                Строка под диаграммой — общий темп <Text style={styles.infoBold}>гибких трат</Text> по дням: где-то
                больше, где-то меньше — важно, укладываетесь ли вы в сумме. Фиксированные траты (аренда, подписки) и
                категории с нормой «в месяц» (крупные разовые покупки) в неё не входят.
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Категория с планом:</Text> полоска — какая часть плана категории на месяц
                ушла за этот период. Под ней — доля категории во всех тратах за период и доля от плана на месяц (на стыке
                месяцев — отдельно для каждого месяца).
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Цветная строка</Text> — траты гибкой категории против её нормы. Норма
                считается в ритме, заданном в плане: в день (еда), в неделю (бары), за 2 недели или в месяц (одежда).
                Если период короче ритма, берётся неделя / 2 недели / месяц, куда он попадает, — например, для баров за
                день видно всю неделю: «73 · 61% от плана на неделю 28 сен – 4 окт».
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
                больше плана на месяц. Для периода на стыке месяцев — месяца, в котором период заканчивается.
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
