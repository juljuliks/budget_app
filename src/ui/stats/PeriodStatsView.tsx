import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, parseYm, periodStats, PeriodStats } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { useOpenCategoryTransactions } from '../../navigation';
import { onTransactionsChanged } from '../../events';
import BottomSheet, { SheetScrollView } from '../BottomSheet';
import Button from '../Button';
import { DayRange, dayKeyOf, daysInMonth, parseDayKey, rangeDays, rangeToUnix, shortRange } from '../dateRange';
import { flatOf, isPartOfWindow, limitChange, loadNorms, NormPart, Norms, Pace, paceOf, rhythmBar } from './norms';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import Meter from '../Meter';
import { formatWithCurrency } from '../money';
import { NO_RATE, PER_PERIOD, SPENDING_PATTERN } from '../strings';
import { plural } from '../format';
import { colors } from '../theme';
import { DonutCenter, RefundsRow } from './StatsView';
import { useLatestRequest } from '../useLatestRequest';
import SummaryTiles, { GROUP_TITLES } from './SummaryTiles';
import { pct, SummaryGroupKey, summaryGroups } from './summaryGroups';

/** Periods up to this long are measured against the plan (its share for these days); longer ones aren't. */
const PACE_MAX_DAYS = 31;

type Props = {
  range: DayRange;
  /** "на день" / "на неделю" / "на период" (no longer shown: the summary names the days by numbers) */
  normLabel?: string;
  emptyText?: string;
};

const MONTHS_IN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** days in a rhythm window */
const RHYTHM_LEN = { day: 1, week: 7, '2weeks': 14, month: 0 } as const;

/** what an explanation sheet is about: the line under the donut, a category, a limits block */
type Info = 'summary' | { id: number; name: string } | { group: SummaryGroupKey };

/** what a limits block counts, in plain words */
const GROUP_ABOUT: Record<SummaryGroupKey, string> = {
  day: 'Категории с лимитом на день: лимит на выбранные дни.',
  week: 'Категории с лимитом на неделю. Если период короче недели, считается вся неделя, как в строках категорий: траты в другие её дни тоже входят.',
  '2weeks': 'Категории с лимитом на 2 недели. Если период короче, считаются обе недели целиком: траты в другие их дни тоже входят.',
  month: 'Категории, которые вы тратите «крупно, раз в месяц»: план на месяц и траты с 1-го.',
  outside: 'Траты за период, которые в лимиты не входят: обязательные платежи, переводы, категории без плана.',
};

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

/** One look for every ⓘ on this screen. */
const INFO_SIZE = 18;


/**
 * Spending of a period by category, with a donut. A short period (a day, a week, up to a month) is measured
 * against the plan's norm for these days: are we on pace? A long one (a year) shows the structure and the
 * average per month.
 */
export default function PeriodStatsView({ range, emptyText = 'За этот период трат нет.' }: Props) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [norms, setNorms] = useState<Norms | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // which explanation is open: the line under the donut or a category's block
  const [infoOpen, setInfoOpen] = useState<Info | null>(null);
  // the formulas in an explanation, folded by default
  const [calcOpen, setCalcOpen] = useState(false);
  const openInfo = (v: Info) => { setCalcOpen(false); setInfoOpen(v); };
  // a long period: the average over its full months with data (undefined = loading, null = none yet)
  const [average, setAverage] = useState<{ average_minor: number; months: number } | null | undefined>(undefined);
  // the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();
  const openTransactions = useOpenCategoryTransactions();
  const days = rangeDays(range);
  const today = dayKeyOf(new Date());
  const pace = days <= PACE_MAX_DAYS;

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous period (switched quickly) are dropped
    const keep = latest();
    const { from, to } = rangeToUnix(range);
    if (pace) {
      // a day / week / 2-week limit not touched in the period but spent earlier in the month is listed too (0 ₾):
      // to see its limit grow after a day without spending
      loadNorms(range, currency).then((n) => {
        const planned = [...n.byCategory].filter(([id, p]) => p.kind === 'limit' && p.rhythm !== 'month' && p.periodNorm > 0
          && (n.monthToDate.get(id) ?? 0) > 0).map(([id]) => id);
        return periodStats(from, to, currency, planned).then(keep((s: PeriodStats) => { setNorms(n); setStats(s); }));
      }).catch((e) => console.error('load period stats failed', e));
    } else {
      setNorms(null);
      periodStats(from, to, currency).then(keep(setStats)).catch((e) => console.error('load period stats failed', e));
    }
    if (!pace) averageFullMonths(range.from, range.to, currency).then(keep(setAverage)).catch((e) => console.error('load average failed', e));
  }, [range, currency, pace, latest]);
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
  /** "(500 ₾ − 120 ₾) / 28 × 7 = 95 ₾": what's left of the month's plan over the days left, per month part */
  const formula = (parts: NormPart[]) => {
    const total = parts.reduce((a, p) => a + p.norm, 0);
    const terms = parts.map((p) => (p.spentBefore > 0
      ? `(${m(p.limit)} − ${m(p.spentBefore)}) / ${p.daysLeft} × ${p.days}`
      : `${m(p.limit)} / ${p.daysLeft} × ${p.days}`)).join(' + ');
    return parts.length > 1 ? `${terms} = ${parts.map((p) => m(p.norm)).join(' + ')} = ${m(total)}` : `${terms} = ${m(total)}`;
  };
  /** "в сентябре плана нет — его дни считаются как 0" for the parts without a plan */
  const noPlan = (parts: NormPart[]) => {
    const missing = parts.filter((p) => p.limit === 0).map((p) => MONTHS_PREP[parseYm(p.ym).month]);
    return missing.length ? ` В ${missing.join(' и ')} у категории плана нет — эти дни считаются как 0.` : '';
  };
  const monthIn = norms ? MONTHS_IN[parseYm(norms.ym).month] : '';
  // under the donut: the limits by rhythm as tiles, or the average per month for a long period
  const groups = pace && norms ? summaryGroups(norms, range, stats.spent_minor, today) : [];
  const limited = groups.filter((g) => g.key !== 'outside');
  const catInfo = infoOpen && typeof infoOpen === 'object' && 'id' in infoOpen ? infoOpen : null;
  const groupInfo = infoOpen && typeof infoOpen === 'object' && 'group' in infoOpen ? infoOpen : null;
  const openGroup = groupInfo ? groups.find((g) => g.key === groupInfo.group) : undefined;
  /** "Недельные лимиты · 28 сен – 4 окт" */
  const groupTitle = (key: SummaryGroupKey) => {
    const g = groups.find((x) => x.key === key);
    const name = key === 'outside' ? GROUP_TITLES.outside : `${GROUP_TITLES[key]} лимиты`;
    return g?.window && key !== 'month' ? `${name} · ${shortRange(g.window)}` : key === 'month' ? `${name} · ${monthIn}` : name;
  };
  // the period's spending in no limit, by category (the "Вне лимитов" block's calculation)
  const outsideCats = stats.categories.filter((c) => c.spent_minor > 0
    && (c.category_id === null || norms?.byCategory.get(c.category_id)?.kind !== 'limit'));
  const summary = pace
    ? (limited.length ? null : 'Плана на эти дни нет — показана только структура трат.')
    : average === undefined ? ''
      : average === null ? 'Для среднего в месяц нужен хотя бы один полный месяц с данными.'
        : `В среднем ${money(average.average_minor)} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;

  const paceStyle = (p: Pace) => (p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver);
  const paceName = (p: Pace) => (p === 'ok' ? 'зелёный' : p === 'ahead' ? 'оранжевый' : 'красный');
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={cur} />
        </Donut>
      </View>
      {limited.length ? (
        <>
          <Text style={styles.tilesTitle}>Лимиты</Text>
          <SummaryTiles groups={groups} money={money} onPress={(key) => openInfo({ group: key })} />
        </>
      ) : (
        <TouchableOpacity style={styles.summaryRow} onPress={() => openInfo('summary')} accessibilityLabel="Как считаются траты">
          <Text style={styles.summary}>{summary}</Text>
          <InfoIcon color={colors.accent} size={INFO_SIZE} />
        </TouchableOpacity>
      )}

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
            const name = `${c.emoji || ''} ${c.name}`.trim();
            return (
              // tap: the category's operations in this period (the ⓘ line inside keeps its own tap)
              <TouchableOpacity
                key={String(c.category_id)}
                style={styles.row}
                onPress={() => openTransactions(c.category_id, range)}
                accessibilityHint="Показать операции категории за период"
              >
                <View style={styles.rowTop}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.amount}>
                    {money(c.spent_minor)}
                    {plan?.kind === 'limit' && plan.rhythm !== 'month' && !isPartOfWindow(plan.window, range) && plan.periodNorm > 0
                      ? <Text style={styles.ofLimit}> / {m(plan.periodNorm)} ({pct(c.spent_minor, Math.round(plan.periodNorm))})</Text> : null}
                  </Text>
                </View>
                {plan?.kind === 'limit' && plan.rhythm !== 'month' ? (() => {
                  // a period shorter than the category's rhythm (a day of a weekly limit) is measured as the whole rhythm
                  // window so far: a weekly category is meant to be spent unevenly, a day's share of it would read as overspend
                  const whole = isPartOfWindow(plan.window, range);
                  const limit = Math.round(whole ? plan.windowNorm : plan.periodNorm);
                  const spent = whole ? plan.windowSpent : c.spent_minor;
                  const left = limit - spent;
                  const p = paceOf(spent, limit, mtd, plan.monthLimit);
                  const end = whole ? plan.window.to : range.to;
                  const ongoing = end >= today;
                  // the other days of the window, drawn faded before this period's part
                  const others = whole ? Math.max(0, spent - Math.min(c.spent_minor, spent)) : 0;
                  return (
                    <>
                      {/* the bar is scaled to the bigger of the two: an overspend shows how far past the limit */}
                      {limit > 0 ? (
                        spent <= limit ? <Meter ratio={spent / limit} base={others / limit} height={8} color={c.color} />
                          : whole ? <Meter ratio={1} base={others / spent} limitTick={limit / spent} height={8} color={c.color} />
                            : <Meter ratio={1} over={limit / spent} height={8} color={c.color} />
                      ) : null}
                      <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
                        <Text style={[styles.share, styles.paceText]}>
                          {whole ? `${plan.rhythm === 'week' ? 'Неделя' : '2 недели'} ${shortRange(plan.window)}: ` : ''}
                          {limit > 0 ? (
                            <>
                              <Text style={[styles.pace, paceStyle(p)]}>
                                {(left < 0 ? `перерасход ${money(-left)}` : ongoing ? `осталось ${money(left)}` : `сэкономлено ${money(left)}`).replace(/^./, (ch) => (whole ? ch : ch.toUpperCase()))}
                              </Text>
                              {left >= 0 && ongoing && rangeDays({ from: whole ? plan.window.from : range.from, to: end }) > 1 ? ` · до ${WEEKDAYS[parseDayKey(end).getDay()]}` : ''}
                            </>
                          ) : `${whole ? 'п' : 'П'}лана нет`}
                          {/* how the period moved the limit: at its start (crossed out) → for the rest of the month after it */}
                          {plan.effect ? (() => {
                            const { before, after } = plan.effect;
                            const moved = after !== null && Math.round(after) !== Math.round(before);
                            const unit = PER_PERIOD[plan.rhythm];
                            return moved ? (
                              <>
                                {'\nИзменение лимита: '}<Text style={styles.crossed}>{m(before)}</Text>{' → '}
                                <Text style={after! < before ? styles.paceAhead : styles.paceOk}>{m(after!)}</Text> {unit}
                              </>
                            ) : `\nЛимит ${unit} ${m(before)}`;
                          })() : null}
                        </Text>
                        <InfoIcon color={colors.accent} size={INFO_SIZE} />
                      </TouchableOpacity>
                    </>
                  );
                })() : plan?.kind === 'limit' ? (() => {
                  // "крупно, раз в месяц": not split by days, the month's plan so far
                  const left = Math.round(plan.windowNorm) - plan.windowSpent;
                  const p = paceOf(plan.windowSpent, plan.windowNorm, mtd, plan.monthLimit);
                  const bar = rhythmBar(plan, range, c.spent_minor);
                  return (
                    <>
                      <Meter ratio={bar.ratio} base={bar.base} height={8} color={c.color} />
                      <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
                        <Text style={[styles.share, styles.paceText]}>
                          <Text style={[styles.pace, paceStyle(p)]}>
                            На {monthIn} {left < 0 ? `перерасход ${money(-left)}` : `осталось ${money(left)}`}
                          </Text>
                        </Text>
                        <InfoIcon color={colors.accent} size={INFO_SIZE} />
                      </TouchableOpacity>
                    </>
                  );
                })() : plan ? (
                  // a fixed payment: the month's plan, not split by days
                  <>
                    {plan.monthLimit > 0 ? <Meter ratio={mtd / plan.monthLimit} height={8} color={c.color} /> : null}
                    <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
                      <Text style={styles.share}>
                        {plan.monthLimit > 0 ? `${money(mtd)} из ${money(plan.monthLimit)} на ${monthIn}` : `в ${MONTHS_PREP[parseYm(norms!.ym).month]} плана нет`}
                      </Text>
                      <InfoIcon color={colors.accent} size={INFO_SIZE} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.share}>{pct(c.spent_minor, stats.spent_minor)} всех трат</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, range, ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <BottomSheet
        visible={infoOpen !== null}
        onClose={() => setInfoOpen(null)}
        title={catInfo ? catInfo.name : groupInfo ? groupTitle(groupInfo.group) : pace ? 'Траты за период' : 'Среднее в месяц'}
        style={styles.infoSheet}
      >
        {/* the text scrolls, "Понятно" stays at the bottom; every calculation is set apart in a code style */}
        <SheetScrollView style={styles.infoScroll} contentContainerStyle={styles.info}>
          {catInfo && norms?.byCategory.get(catInfo.id) ? (() => {
            // in plain words first, this category's real numbers; the formulas under "Как посчитано"
            const p = norms.byCategory.get(catInfo.id)!;
            const mtd = norms.monthToDate.get(catInfo.id) ?? 0;
            // a flexible category is checked over the viewed days, a month-rhythm one over the month so far
            const byMonth = p.rhythm === 'month';
            // a day of a weekly limit: the whole week
            const byWindow = !byMonth && isPartOfWindow(p.window, range);
            const norm = byMonth || byWindow ? p.windowNorm : p.periodNorm;
            const spent = byMonth || byWindow ? p.windowSpent : stats.categories.find((c) => c.category_id === catInfo.id)?.spent_minor ?? p.periodSpent;
            const parts = byMonth || byWindow ? p.windowParts : p.periodParts;
            const pace_ = paceOf(spent, norm, mtd, p.monthLimit);
            const bar = rhythmBar(p, range, Math.min(p.windowSpent, stats.categories.find((c) => c.category_id === catInfo.id)?.spent_minor ?? 0));
            // the limit vs the plan's flat share, shown when more than 5% off
            const flat = byMonth ? norm : flatOf(parts);
            const change = byMonth ? null : limitChange(norm, flat);
            const whole = byMonth ? `план на ${monthIn}` : byWindow ? `лимит на ${p.rhythm === 'week' ? 'неделю' : '2 недели'} ${shortRange(p.window)}` : `лимит на ${shortRange(range)}`;
            if (p.kind !== 'limit') {
              return (
                <Text style={styles.infoText}>
                  Обязательный платёж (аренда, подписка): по дням не делится. Прогресс — план на {monthIn}:{' '}
                  <Text style={styles.infoBold}>{money(mtd)} из {money(p.monthLimit)}</Text>.
                </Text>
              );
            }
            return (
              <>
                <Text style={styles.infoText}>
                  {capitalize(whole)}:{' '}
                  {change ? <><Text style={styles.crossed}>{m(flat)}</Text>{' → '}</> : null}
                  <Text style={[styles.infoBold, change === 'down' ? styles.paceAhead : change === 'up' ? styles.paceOk : null]}>{m(norm)}</Text>
                  {change === 'down' ? ' — меньше плана из-за перерасхода раньше в месяце' : change === 'up' ? ' — больше плана за счёт экономии раньше в месяце' : ''}.
                  {byMonth ? ' С 1-го потрачено' : byWindow ? ` За ${p.rhythm === 'week' ? 'неделю' : '2 недели'} потрачено` : ' Потрачено'} <Text style={styles.infoBold}>{money(spent)}</Text> —{' '}
                  <Text style={[styles.infoBold, paceStyle(pace_)]}>{delta(spent, norm)}</Text>.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Прогресс</Text>{byMonth
                    ? <> — весь {monthIn}:{bar.base > 0 ? ' бледная часть — траты в другие дни, яркая — за выбранный период.' : ' заполнение — сколько плана потрачено.'}</>
                    : byWindow ? ` — вся ${p.rhythm === 'week' ? 'неделя' : 'пара недель'}: бледная часть — траты в другие дни, яркая — за выбранный период. При перерасходе полоса — все траты, черта — лимит.`
                      : ' — траты к лимиту этих дней. При перерасходе полоса — все траты: яркая часть до черты — лимит, бледная — сверх него.'}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={[styles.infoBold, styles.paceOk]}>Зелёный</Text> — в пределах лимита.{'\n'}
                  <Text style={[styles.infoBold, styles.paceAhead]}>Оранжевый</Text> — больше лимита, но месяц пока укладывается в план.{'\n'}
                  <Text style={[styles.infoBold, styles.paceOver]}>Красный</Text> — план месяца превышен.
                </Text>
                {p.effect && p.effect.after !== null && !byMonth ? (
                  // how this period moved the limit for the rest of the month
                  <Text style={styles.infoText}>
                    <Text style={styles.infoBold}>После этого периода</Text> лимит {PER_PERIOD[p.rhythm]}:{' '}
                    <Text style={styles.crossed}>{m(p.effect.before)}</Text>{' → '}
                    <Text style={[styles.infoBold, p.effect.after < p.effect.before ? styles.paceAhead : styles.paceOk]}>{m(p.effect.after)}</Text>
                    {p.effect.after < p.effect.before ? ' — траты периода больше лимита, на остаток месяца меньше.' : p.effect.after > p.effect.before ? ' — траты периода меньше лимита, на остаток месяца больше.' : '.'}
                  </Text>
                ) : null}
                <TouchableOpacity onPress={() => setCalcOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: calcOpen }}>
                  <Text style={styles.calcToggle}>{calcOpen ? 'Скрыть расчёт ⌃' : 'Как посчитано ›'}</Text>
                </TouchableOpacity>
                {calcOpen ? (
                  <>
                    {p.effect && p.effect.after !== null && p.rhythm !== 'month' ? (
                      <Text style={styles.infoText}>
                        Лимит после периода — что осталось от плана на {monthIn} после трат с 1-го по {shortRange({ from: range.to, to: range.to })}, на
                        оставшиеся дни: <Code>({m(p.monthLimit)} − {m(mtd)}) / {daysInMonth(norms.ym) - Number(range.to.slice(8, 10))} × {RHYTHM_LEN[p.rhythm]} = {m(p.effect.after)}</Code>.
                      </Text>
                    ) : null}
                    <Text style={styles.infoText}>
                      Лимит считается из плана по тому, как вы тратите («{SPENDING_PATTERN[p.rhythm].title.toLowerCase()}», задаётся в плане){byMonth ? (
                        <> — весь план на {monthIn}: <Code>{m(p.monthLimit)}</Code>.</>
                      ) : (
                        <>
                          {' '}— что осталось от плана месяца, делится на оставшиеся дни месяца и умножается на дни {byWindow ? (p.rhythm === 'week' ? 'недели' : 'двух недель') : 'периода'}: перерасход раньше в месяце уменьшает лимит, экономия увеличивает. Каждый месяц считается своим планом:{' '}
                          <Code>{formula(parts)}</Code>.{noPlan(parts)}
                        </>
                      )}
                    </Text>
                    <Text style={styles.infoText}>
                      Цвет: <Code>{m(spent)} {spent <= Math.round(norm) ? '≤' : '>'} {m(norm)}</Code>
                      {pace_ === 'ok' ? null : (
                        <>, с 1-го <Code>{m(mtd)} {mtd <= p.monthLimit ? '≤' : '>'} {m(p.monthLimit)}</Code></>
                      )}{' '}
                      → <Text style={[styles.infoBold, paceStyle(pace_)]}>{paceName(pace_)}</Text>.
                    </Text>
                  </>
                ) : null}
              </>
            );
          })() : groupInfo && openGroup ? (() => {
            // a limits block: its total, what it counts, how the period moved the limit, each category's numbers
            const g = openGroup;
            const per = g.key === 'day' || g.key === 'week' || g.key === '2weeks' ? PER_PERIOD[g.key] : '';
            const after = g.change?.after ?? null;
            return (
              <>
                <Text style={styles.infoText}>
                  {g.key === 'outside' ? <>Потрачено <Text style={styles.infoBold}>{money(g.spent)}</Text>.</> : (
                    <>
                      {g.key === 'month' ? 'С 1-го потрачено' : 'Потрачено'} <Text style={styles.infoBold}>{money(g.spent)}</Text> из{' '}
                      <Text style={styles.infoBold}>{m(g.limit)}</Text> —{' '}
                      <Text style={[styles.infoBold, g.spent > Math.round(g.limit) ? styles.paceAhead : styles.paceOk]}>{delta(g.spent, g.limit)}</Text>.
                    </>
                  )}
                </Text>
                <Text style={styles.infoText}>{GROUP_ABOUT[g.key]}</Text>
                {g.change && after !== null ? (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoBold}>После этого периода</Text> лимит {per}:{' '}
                    <Text style={styles.crossed}>{m(g.change.before)}</Text>{' → '}
                    <Text style={[styles.infoBold, after < g.change.before ? styles.paceAhead : styles.paceOk]}>{m(after)}</Text>
                    {after < g.change.before ? ' — траты больше лимита, на остаток месяца меньше.' : after > g.change.before ? ' — траты меньше лимита, на остаток месяца больше.' : '.'}
                  </Text>
                ) : null}
                <Text style={styles.calcTitle}>Расчёт</Text>
                {g.key === 'outside' ? (
                  <Text style={styles.infoText}>
                    {outsideCats.map((c) => (
                      <React.Fragment key={String(c.category_id)}>
                        {`${c.emoji || ''} ${c.name}`.trim()}: <Code>{money(c.spent_minor)}</Code>{'\n'}
                      </React.Fragment>
                    ))}
                  </Text>
                ) : (
                  <Text style={styles.infoText}>
                    {g.items.map((i) => (
                      <React.Fragment key={i.id}>
                        <Text style={styles.infoBold}>{i.name}</Text>: потрачено <Code>{money(i.spent)}</Code>,{' '}
                        {g.key === 'month' ? <>план <Code>{m(i.limit)}</Code></> : <>лимит <Code>{formula(i.parts)}</Code></>}.{noPlan(i.parts)}{'\n'}
                      </React.Fragment>
                    ))}
                    {g.items.length > 1 ? <>Итого: <Code>{money(g.spent)} из {g.items.map((i) => m(i.limit)).join(' + ')} = {m(g.limit)}</Code>.</> : null}
                  </Text>
                )}
                {g.key !== 'outside' && g.key !== 'month' ? (
                  <Text style={styles.infoText}>
                    Лимит — что осталось от месячного плана категории, разложенное на оставшиеся дни месяца: перерасход раньше в
                    месяце уменьшает его, экономия увеличивает. Каждый месяц считается своим планом.
                  </Text>
                ) : null}
              </>
            );
          })() : pace ? (
            <Text style={styles.infoText}>
              На эти дни плана нет: показана только структура трат. Задайте лимиты категорий в плане — здесь появятся
              дневные, недельные и месячные лимиты.
            </Text>
          ) : (
            <Text style={styles.infoText}>
              Период длиннее месяца с планом не сравнивается: показана структура трат по категориям и среднее в месяц.
              Среднее считается только по полным месяцам с данными: текущий месяц ещё не закончился, а первый не
              учитывается, если учёт начался не с 1-го числа. Так аренда в начале месяца и дни до установки
              приложения не искажают цифру.
            </Text>
          )}
          <Text style={styles.infoText}>Все суммы — в валюте из настроек, по курсу на день каждой траты.</Text>
        </SheetScrollView>
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
  calcTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 4, marginBottom: 6 },
  tilesTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 4, marginBottom: 8 },
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
  paceText: { flexShrink: 1 },
  paceNeutral: { color: colors.text },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  ofLimit: { fontSize: 13, color: colors.muted },
  info: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  infoBold: { fontWeight: '600' },
  crossed: { textDecorationLine: 'line-through' },
  calcToggle: { fontSize: 15, color: colors.accent, fontWeight: '600', paddingVertical: 4 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13, backgroundColor: colors.surface, color: colors.text },
  infoSheet: { maxHeight: '85%' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoButton: { marginTop: 12, marginHorizontal: 20 },
});
