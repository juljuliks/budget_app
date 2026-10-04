import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, NormPeriod, parseYm, periodStats, PeriodStats, PlanKind } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import BottomSheet from '../BottomSheet';
import Button from '../Button';
import { DayRange, daysInMonth, rangeDays, rangeToUnix, shortRange } from '../dateRange';
import { loadNorms, NormPart, Norms, Pace, paceOf } from './norms';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import Meter from '../Meter';
import { formatWithCurrency } from '../money';
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

const MONTHS_IN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

/** One look for every ⓘ on this screen. */
const INFO_SIZE = 18;

/** "12%", "<1%" for a tiny non-zero share. */
function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
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
  // which explanation is open: the line under the donut or a category's block
  const [infoOpen, setInfoOpen] = useState<'summary' | { id: number; name: string } | null>(null);
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
  const money = (minor: number) => formatWithCurrency(minor, cur);
  /** an amount in a formula: whole minor units, "64.52 ₾" */
  const m = (v: number) => money(Math.round(v));
  /** "перерасход 69 ₾" / "осталось 20 ₾" */
  const delta = (spent: number, norm: number) => {
    const d = Math.round(norm) - spent;
    return d < 0 ? `перерасход ${money(-d)}` : `осталось ${money(d)}`;
  };
  /** "500 ₾ / 30 × 3 + 500 ₾ / 31 × 4 = 50 ₾ + 64.52 ₾ = 114.52 ₾" */
  const formula = (parts: NormPart[]) => {
    const total = parts.reduce((a, p) => a + p.norm, 0);
    const terms = parts.map((p) => `${m(p.limit)} / ${p.dim} × ${p.days}`).join(' + ');
    return parts.length > 1 ? `${terms} = ${parts.map((p) => m(p.norm)).join(' + ')} = ${m(total)}` : `${terms} = ${m(total)}`;
  };
  /** "в сентябре плана нет — его дни считаются как 0" for the parts without a plan */
  const noPlan = (parts: NormPart[]) => {
    const missing = parts.filter((p) => p.limit === 0).map((p) => MONTHS_PREP[parseYm(p.ym).month]);
    return missing.length ? ` В ${missing.join(' и ')} у категории плана нет — эти дни считаются как 0.` : '';
  };
  const monthIn = norms ? MONTHS_IN[parseYm(norms.ym).month] : '';
  const dim = norms ? daysInMonth(norms.ym) : 0;
  // days from the 1st up to the period's end: where an even pace would be by now
  const elapsed = Number(range.to.slice(8, 10));
  const flexSpent = norms?.flexSpent ?? 0;

  // under the donut: the pace against the whole plan, or the average per month for a long period
  const summary = pace
    ? (norms && norms.total > 0
      ? `Гибкие траты: ${money(flexSpent)} из ${m(norms.total)} ${normLabel} · ${delta(flexSpent, norms.total)}`
      : 'Плана на эти дни нет — показана только структура трат.')
    : average === undefined ? ''
      : average === null ? 'Для среднего в месяц нужен хотя бы один полный месяц с данными.'
        : `В среднем ${money(average.average_minor)} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;

  const paceStyle = (p: Pace) => (p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver);
  const paceName = (p: Pace) => (p === 'ok' ? 'зелёный' : p === 'ahead' ? 'оранжевый' : 'красный');
  const rhythmName = (r: NormPeriod) => (r === 'day' ? 'в день' : r === 'week' ? 'в неделю' : r === '2weeks' ? 'за 2 недели' : 'в месяц');
  const hasMarker = (p: { kind: PlanKind; rhythm: NormPeriod }) => p.kind === 'limit' && p.rhythm !== 'month';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={cur} />
        </Donut>
      </View>
      <TouchableOpacity style={styles.summaryRow} onPress={() => setInfoOpen('summary')} accessibilityLabel="Как считаются гибкие траты">
        <Text style={styles.summary}>{summary}</Text>
        <InfoIcon color={colors.accent} size={INFO_SIZE} />
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
            const mtd = (c.category_id !== null && norms?.monthToDate.get(c.category_id)) || 0;
            return (
              <View key={String(c.category_id)} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                  <Text style={styles.amount}>{money(c.spent_minor)}</Text>
                </View>
                {plan ? (
                  <>
                    {/* the month's plan: faded — spent earlier this month, bright — in the period; the tick — an even pace by the period's end */}
                    {plan.monthLimit > 0 ? (
                      <Meter
                        ratio={mtd / plan.monthLimit}
                        base={(mtd - plan.spent) / plan.monthLimit}
                        marker={hasMarker(plan) ? elapsed / dim : undefined}
                        height={8}
                        color={c.color}
                      />
                    ) : null}
                    <Text style={styles.share}>
                      {pct(c.spent_minor, stats.spent_minor)} всех трат за период · {plan.monthLimit > 0
                        ? `${pct(plan.spent, plan.monthLimit)} плана на ${monthIn}${mtd > plan.spent ? ` · с 1-го ${pct(mtd, plan.monthLimit)}` : ''}`
                        : `в ${MONTHS_PREP[parseYm(norms!.ym).month]} плана нет`}
                    </Text>
                    {/* the category's norm over its own rhythm window (fixed payments aren't split by days) */}
                    {plan.kind === 'limit' ? (() => {
                      const p = paceOf(plan.windowSpent, plan.windowNorm, mtd, plan.monthLimit);
                      const sameWindow = plan.window.from === range.from && plan.window.to === range.to;
                      // by the rhythm, without dates: the window is the week / two weeks / month around the period
                      const label = sameWindow ? normLabel
                        : plan.rhythm === 'month' ? `на ${monthIn}`
                          : plan.rhythm === 'week' ? 'на неделю' : 'на 2 недели';
                      return (
                        <TouchableOpacity style={styles.paceRow} onPress={() => setInfoOpen({ id: c.category_id!, name: `${c.emoji || ''} ${c.name}`.trim() })} accessibilityLabel="Как считается категория">
                          <Text style={[styles.share, styles.pace, paceStyle(p)]}>
                            {m(plan.windowSpent)} из {m(plan.windowNorm)} {label} · {delta(plan.windowSpent, plan.windowNorm)}
                          </Text>
                          <InfoIcon color={colors.accent} size={INFO_SIZE} />
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

      <BottomSheet
        visible={infoOpen !== null}
        onClose={() => setInfoOpen(null)}
        title={typeof infoOpen === 'object' && infoOpen ? infoOpen.name : pace ? 'Гибкие траты' : 'Среднее в месяц'}
        style={styles.infoSheet}
      >
        {/* the text scrolls, "Понятно" stays at the bottom; every calculation is set apart in a code style */}
        <ScrollView style={styles.infoScroll} contentContainerStyle={styles.info}>
          {typeof infoOpen === 'object' && infoOpen && norms?.byCategory.get(infoOpen.id) ? (() => {
            // this category's real numbers in every formula
            const p = norms.byCategory.get(infoOpen.id)!;
            const mtd = norms.monthToDate.get(infoOpen.id) ?? 0;
            const before = mtd - p.spent;
            const pace_ = paceOf(p.windowSpent, p.windowNorm, mtd, p.monthLimit);
            const evenPace = (p.monthLimit * elapsed) / dim;
            return (
              <>
                {p.monthLimit > 0 ? (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoBold}>Полоска</Text> — план на {monthIn}: <Code>{m(p.monthLimit)}</Code>. Яркая
                    часть — потрачено за период: <Code>{m(p.spent)} / {m(p.monthLimit)} = {pct(p.spent, p.monthLimit)}</Code>.
                    {before > 0 ? (
                      <>
                        {' '}Бледная — раньше в этом месяце: <Code>{m(before)}</Code>, вместе с 1-го:{' '}
                        <Code>{m(before)} + {m(p.spent)} = {m(mtd)} ({pct(mtd, p.monthLimit)})</Code>.
                      </>
                    ) : null}
                    {hasMarker(p) ? (
                      <>
                        {' '}<Text style={styles.infoBold}>Риска</Text> — сколько было бы потрачено к {shortRange({ from: range.to, to: range.to })} при
                        ровном темпе: <Code>{m(p.monthLimit)} / {dim} × {elapsed} = {m(evenPace)} ({pct(evenPace, p.monthLimit)})</Code>.
                        Полоска правее риски — тратите быстрее плана.
                      </>
                    ) : null}
                  </Text>
                ) : (
                  <Text style={styles.infoText}>В {MONTHS_PREP[parseYm(norms.ym).month]} у категории плана нет — полоски нет.</Text>
                )}
                {p.kind === 'limit' ? (
                  <>
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>Норма</Text> ({rhythmName(p.rhythm)}, задаётся в плане){p.rhythm === 'month' ? (
                        <> — весь план на {monthIn}: <Code>{m(p.monthLimit)}</Code>, окно — с 1-го числа.</>
                      ) : (
                        <>
                          {' '}за {shortRange(p.window)}: план месяца / дней в месяце × дней окна, по каждому месяцу своим планом:{' '}
                          <Code>{formula(p.windowParts)}</Code>.{noPlan(p.windowParts)}
                        </>
                      )}
                    </Text>
                    <Text style={styles.infoText}>
                      <Text style={styles.infoBold}>Потрачено</Text> за {shortRange(p.window)}:{' '}
                      <Code>{m(p.windowSpent)} из {m(p.windowNorm)}</Code> → {delta(p.windowSpent, p.windowNorm)}.
                    </Text>
                    <Text style={styles.infoText}>
                      <Text style={[styles.infoBold, styles.paceOk]}>Зелёный</Text> — потрачено не больше нормы.{'\n'}
                      <Text style={[styles.infoBold, styles.paceAhead]}>Оранжевый</Text> — больше нормы, но с начала месяца не
                      больше плана на месяц: перерасход можно отыграть.{'\n'}
                      <Text style={[styles.infoBold, styles.paceOver]}>Красный</Text> — с начала месяца потрачено больше плана
                      на месяц.
                    </Text>
                    <Text style={styles.infoText}>
                      Сейчас: <Code>{m(p.windowSpent)} {p.windowSpent <= Math.round(p.windowNorm) ? '≤' : '>'} {m(p.windowNorm)}</Code>
                      {pace_ === 'ok' ? null : (
                        <>, с начала месяца <Code>{m(mtd)} {mtd <= p.monthLimit ? '≤' : '>'} {m(p.monthLimit)}</Code></>
                      )}{' '}
                      → <Text style={[styles.infoBold, paceStyle(pace_)]}>{paceName(pace_)}</Text>.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.infoText}>Фиксированная трата по дням не делится — нормы и цвета нет.</Text>
                )}
              </>
            );
          })() : pace ? (
            <>
              <Text style={styles.infoText}>
                Общий темп <Text style={styles.infoBold}>гибких трат</Text> за {shortRange(range)}: сколько потрачено против
                суммы их норм. Где-то больше, где-то меньше — важно, укладываетесь ли вы в сумме.
                {norms && norms.total > 0 ? (
                  <> Сейчас: <Code>{money(flexSpent)} из {m(norms.total)}</Code> → {delta(flexSpent, norms.total)}.</>
                ) : null}
              </Text>
              <Text style={styles.infoText}>
                Норма категории — план месяца / дней в месяце × дней периода; если период захватывает два месяца, каждый
                считается своим планом, а месяц без плана — как 0.
              </Text>
              {norms?.flex.map((f) => (
                <Text key={f.id} style={styles.infoText}>
                  <Text style={styles.infoBold}>{f.name}</Text>: потрачено <Code>{money(f.spent)}</Code>, норма{' '}
                  <Code>{formula(f.parts)}</Code>.{noPlan(f.parts)}
                </Text>
              ))}
              {norms && norms.flex.length > 1 ? (
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Итого норма</Text>: <Code>{norms.flex.map((f) => m(f.norm)).join(' + ')} = {m(norms.total)}</Code>.
                </Text>
              ) : null}
              <Text style={styles.infoText}>
                Не входят: фиксированные траты (аренда, подписки), категории с нормой «в месяц» (крупные разовые покупки)
                и категории без плана.
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
        <Button title="Понятно" onPress={() => setInfoOpen(null)} style={styles.infoButton} />
      </BottomSheet>
    </ScrollView>
  );
}

/** A calculation inside the explanation text: monospace on a tinted background. */
function Code({ children }: { children: React.ReactNode }) {
  return <Text style={styles.code}>{children}</Text>;
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
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13, backgroundColor: colors.surface, color: colors.text },
  infoSheet: { maxHeight: '85%' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoButton: { marginTop: 12, marginHorizontal: 20 },
});
