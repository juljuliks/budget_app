import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { averageFullMonths, NormPeriod, CategoryStat, parseYm, periodStats, PeriodStats } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { useOpenCategoryTransactions } from '../../navigation';
import { onTransactionsChanged } from '../../events';
import BottomSheet, { SheetScrollView } from '../BottomSheet';
import Button from '../Button';
import { DayRange, dayKeyOf, daysInMonth, parseDayKey, rangeDays, rangeToUnix, shortRange } from '../dateRange';
import { flatOf, isPartOfWindow, limitChange, loadNorms, NormPart, Norms, Pace, paceOf, rhythmBar } from './norms';
import Donut from '../Donut';
import { InfoIcon } from '../icons';
import { MaskedTotal } from '../Masked';
import { useHideAmounts } from '../../hideAmounts';
import Meter from '../Meter';
import { formatShort, formatWithCurrency } from '../money';
import { NO_RATE, PER_PERIOD, SPENDING_PATTERN } from '../strings';
import { plural } from '../format';
import { chart, colors } from '../theme';
import { DonutCenter, RefundsRow } from './StatsView';
import { useLatestRequest } from '../useLatestRequest';
import { categoryLabel } from '../../db/categories';
import { GROUP_TITLES, pct, SummaryGroupKey, summaryGroups } from './summaryGroups';
import { formStyles } from '../formStyles';
import { splitUnplanned, unplannedMonth } from './unplanned';
import StickyScrollView, { SectionHeader } from '../StickyScrollView';

/** Periods up to this long are measured against the plan (its share for these days); longer ones aren't. */
const PACE_MAX_DAYS = 31;

type Props = {
  range: DayRange;
  /** "на день" / "на неделю" / "на период": the period's kind, for the section headers ("за неделю") */
  normLabel?: string;
  emptyText?: string;
};

/**
 * After a "₾" that ends a line: Android takes the sign's width from the main font though it comes from a fallback one,
 * and cut it off ("0 / 106.81" without "₾"); a no-break space after it is what gets cut instead.
 */
const GLYPH_ROOM = '\u00a0';

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
  fixed: 'Аренда, подписки, кредит: оплачено с 1-го числа против плана месяца. Остаток — сколько ещё предстоит оплатить, это не свободные деньги. Переплата — перерасход.',
  outside: 'Категории без плана в этом месяце и траты без категории. Доля на них задаётся в бюджете месяца — она как месячный лимит: траты с 1-го против неё.',
};

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
const overStyle = (spent: number, limit: number) => (limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined);

/** the bottom section of the categories without a plan (as in the plan and the month) */
const UNPLANNED = 'Вне плана';
/** planned categories whose limit these days can't measure: just their spending */
const OTHER = 'Другие траты';
/** day / week categories over their month's plan: no limit left, a section of their own */
const OVERSPENT = 'Перерасход плана месяца';

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

/** One look for every ⓘ on this screen. */
const INFO_SIZE = 18;


/**
 * Spending of a period by category, with a donut. A short period (a day, a week, up to a month) is measured
 * against the plan's norm for these days: are we on pace? A long one (a year) shows the structure and the
 * average per month.
 */
export default function PeriodStatsView({ range, normLabel, emptyText = 'За этот период трат нет.' }: Props) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [norms, setNorms] = useState<Norms | null>(null);
  // the month the period ends in: which categories have a plan, the spending outside it and its share (a day / week only)
  const [month, setMonth] = useState<Awaited<ReturnType<typeof unplannedMonth>> | null>(null);
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
  // measured against the plan only within one month: a period across months (or a year) is just its categories
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  const pace = days <= PACE_MAX_DAYS && sameMonth;

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
        return Promise.all([periodStats(from, to, currency, planned), unplannedMonth(n.ym, currency, range.to)])
          .then(keep(([s, u]: [PeriodStats, Awaited<ReturnType<typeof unplannedMonth>>]) => { setNorms(n); setMonth(u); setStats(s); }));
      }).catch((e) => console.error('load period stats failed', e));
    } else {
      setNorms(null);
      setMonth(null);
      periodStats(from, to, currency).then(keep(setStats)).catch((e) => console.error('load period stats failed', e));
    }
    if (!pace) averageFullMonths(range.from, range.to, currency).then(keep(setAverage)).catch((e) => console.error('load average failed', e));
  }, [range, currency, pace, latest]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);

  // hooks before the loading return: their order must not change between renders
  const hidden = useHideAmounts();
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
  const groups = pace && norms ? summaryGroups(norms, range, stats.spent_minor, today, month ?? undefined) : [];
  const limited = groups.filter((g) => g.key !== 'outside');
  const catInfo = infoOpen && typeof infoOpen === 'object' && 'id' in infoOpen ? infoOpen : null;
  const groupInfo = infoOpen && typeof infoOpen === 'object' && 'group' in infoOpen ? infoOpen : null;
  const openGroup = groupInfo ? groups.find((g) => g.key === groupInfo.group) : undefined;
  /** "Недельные лимиты · 28 сен – 4 окт", "Обязательные платежи · октябрь" */
  const groupTitle = (key: SummaryGroupKey) => {
    const g = groups.find((x) => x.key === key);
    const name = key === 'outside' ? GROUP_TITLES.outside : key === 'fixed' ? 'Обязательные платежи' : `${GROUP_TITLES[key]} лимиты`;
    const byMonth = key === 'month' || key === 'fixed' || (key === 'outside' && !!g?.limit);
    return byMonth ? `${name} · ${monthIn}` : g?.window ? `${name} · ${shortRange(g.window)}` : name;
  };
  // the period's spending outside the plan, by category (the "Вне плана" block's calculation)
  const outsideCats = stats.categories.filter((c) => c.spent_minor > 0
    && (c.category_id === null || (month ? !month.planned.has(c.category_id) : norms?.byCategory.get(c.category_id) === undefined)));
  const summary = pace
    ? (limited.length ? null : 'Плана на эти дни нет — показана только структура трат.')
    : average === undefined ? ''
      : average === null ? 'Для среднего в месяц нужен хотя бы один полный месяц с данными.'
        : `В среднем ${money(average.average_minor)} в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`;

  const paceStyle = (p: Pace) => (p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver);
  const paceName = (p: Pace) => (p === 'ok' ? 'зелёный' : p === 'ahead' ? 'оранжевый' : 'красный');
  // a day / week: the categories without a plan this month and the uncategorized in one "Вне плана" section at the bottom
  const split = month ? splitUnplanned(stats.groups, (c) => month.planned.has(c.category_id!)) : { groups: stats.groups, unplanned: [], spent: 0 };

  const shorterThanMonth = !!norms && days < daysInMonth(norms.ym);
  /**
   * "Неделя 5 – 11 окт: " before what a weekly limit has left: its days in this month only (a week across months is cut
   * at the month's edge, as its limit is); nothing when those days are just the viewed period.
   */
  const windowLabel = (rhythm: NormPeriod, w: DayRange) => {
    if (!norms) return '';
    const first = `${norms.ym}-01`;
    const last = `${norms.ym}-${String(daysInMonth(norms.ym)).padStart(2, '0')}`;
    const part = { from: w.from < first ? first : w.from, to: w.to > last ? last : w.to };
    if (part.from === range.from && part.to === range.to) return '';
    return `${rhythm === 'week' ? 'Неделя' : '2 недели'} ${shortRange(part)}: `;
  };
  // shorter than a month: grouped by the limit's rhythm (the planned categories; the rest stay in "Вне плана")
  const byLimits = shorterThanMonth && !!month;
  // only the limits this period measures: a day — the daily ones; a week — daily and weekly; two weeks — also the
  // 2-week ones. A longer rhythm (a weekly limit on a day, the month's, obligatory payments) can't be judged by these
  // days: such categories go to "Другие траты" with just their spending
  const fitting = (rhythm: string) => rhythm === 'day' || (rhythm === 'week' && (normLabel === 'на неделю' || days >= 7))
    || (rhythm === '2weeks' && days >= 14);
  const LIMIT_ORDER: SummaryGroupKey[] = ['day', 'week', '2weeks'];
  // a day / week / 2-week category over its month's plan (by the period's end) has no limit left: out of its
  // limit's section (whose total leaves it out too), into its own one after them
  const monthOver = (c: CategoryStat) => {
    const p = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
    return !!p && p.kind === 'limit' && p.rhythm !== 'month' && p.monthLimit > 0 && (norms!.monthToDate.get(c.category_id!) ?? 0) > p.monthLimit;
  };
  const planned = split.groups.flatMap((g) => g.categories);
  const limitSections = byLimits ? LIMIT_ORDER.filter(fitting).map((key) => ({
    key,
    cats: planned.filter((c) => {
      const p = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
      return p && !monthOver(c) ? (p.kind === 'fixed' ? 'fixed' : p.rhythm) === key : false;
    }).sort((a, b) => b.spent_minor - a.spent_minor),
  })).filter((x) => x.cats.length > 0) : [];
  const overspentCats = byLimits ? planned.filter(monthOver).sort((a, b) => b.spent_minor - a.spent_minor) : [];
  const otherCats = byLimits ? planned.filter((c) => {
    const p = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
    return !monthOver(c) && !(p && p.kind === 'limit' && fitting(p.rhythm)) && c.spent_minor > 0;
  }).sort((a, b) => b.spent_minor - a.spent_minor) : [];

  /** A limits section's total, as its tile had it: the bar, what's left or the overspend, how the period moved the limit. */
  const LimitSummary = ({ g }: { g: (typeof groups)[number] }) => {
    const limit = Math.round(g.limit);
    if (limit <= 0) return null;
    const left = limit - g.spent;
    const over = left < 0;
    const paid = g.items.filter((i) => i.spent >= i.limit).length;
    const rhythm = g.key === 'day' || g.key === 'week' || g.key === '2weeks';
    // a rhythm's days end on a weekday ("до вс"), the month's on its last day
    const until = rhythm ? WEEKDAYS[parseDayKey(g.end).getDay()] : monthEndShort;
    const moved = g.change && g.change.after !== null && Math.round(g.change.after) !== Math.round(g.change.before);
    return (
      <View style={styles.limitSummary}>
        {/* each category's spending in its own color; past the limit the bar is the spending, a tick at the limit */}
        {/* the tick stands out of the bar like a category's: the bar clips its segments, not the tick */}
        <View style={styles.stackWrap}>
          <View style={styles.stack}>
            {g.items.filter((i) => i.spent > 0).map((i) => (
              <View key={i.id} style={{ flex: i.spent, backgroundColor: stats.categories.find((c) => c.category_id === i.id)?.color ?? colors.muted }} />
            ))}
            {!over && limit - g.spent > 0 ? <View style={[styles.stackRest, { flex: limit - g.spent }]} /> : null}
          </View>
          {/* as on every bar: no tick at the very end */}
          {over && limit / g.spent < 0.97 ? <View style={[styles.stackTick, { left: `${(limit / g.spent) * 100}%` }]} /> : null}
        </View>
        <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ group: g.key })} accessibilityLabel="Как считается раздел">
          <Text style={[styles.share, styles.paceText]}>
            {/* as in the category rows: the limit first, then what's left */}
            {g.change && rhythm ? (
              <>
                {/* "старый → новый": no "Лимит" word, it's plain what it is */}
                {moved ? <><Text style={styles.crossed}>{m(g.change.before)}</Text>{' → '}</> : 'Лимит '}
                <Text style={moved ? (g.change.after! < g.change.before ? styles.paceAhead : styles.paceOk) : undefined}>{m(moved ? g.change.after! : g.change.before)}</Text>
                {/* no "в неделю": the section says which limit it is */}{'\n'}
              </>
            ) : null}
            {g.window && rhythm ? windowLabel(g.key as NormPeriod, g.window) : !rhythm ? `${capitalize(monthIn)}: ` : ''}
            <Text style={[styles.pace, over ? styles.paceAhead : g.key === 'fixed' ? undefined : styles.paceOk]}>
              {(over ? `перерасход ${money(-left)}` : g.key === 'fixed' ? (left > 0 ? `осталось оплатить ${money(left)}` : 'всё оплачено')
                : g.ongoing ? `осталось ${money(left)}` : `сэкономлено ${money(left)}`).replace(/^./, (ch) => ((g.window && windowLabel(g.key as NormPeriod, g.window)) || !rhythm ? ch : ch.toUpperCase()))}
            </Text>
            {!over && g.ongoing && g.key !== 'fixed' && (g.key !== 'day' || days > 1) ? ` · до ${until}` : ''}
            {g.key === 'fixed' ? ` · ${paid} из ${g.items.length} оплачены` : ''}
          </Text>
          <InfoIcon color={colors.accent} size={INFO_SIZE} />
        </TouchableOpacity>
      </View>
    );
  };
  // what the spending in a section's header is for: "за день", "за неделю", "за 1–4 окт", "с 28 сен по 4 окт"
  const spentFor = normLabel === 'на день' ? 'за день' : normLabel === 'на неделю' && days === 7 ? 'за неделю'
    // a week cut by the month's edge: "за 1–4 окт" — tight, so the " / " after it stays the visible separator
    : normLabel === 'на неделю' ? `за ${shortRange(range).replace(' – ', '–')}`
      : `с ${shortRange({ from: range.from, to: range.from })} по ${shortRange({ from: range.to, to: range.to })}`;
  /** "31 окт": the month's last day, what the month's shares run until */
  const monthEndShort = norms ? shortRange({ from: `${norms.ym}-${daysInMonth(norms.ym)}`, to: `${norms.ym}-${daysInMonth(norms.ym)}` }) : '';
  /** a section's header: "spent in the period / its categories' plans for the month на октябрь", or just the spent */
  const SectionTotal = ({ spent, planned }: { spent: number; planned: number }) => (
    <MaskedTotal style={styles.groupTotal} hiddenText={headerPct(spent, planned)}>
      {/* as in the month stats: "fact / plan ₾ (%)", the fact black without ₾, the rest muted */}
      {planned > 0 ? <Text style={overStyle(spent, planned)}>{formatShort(spent)}</Text> : money(spent)}
      {planned > 0 ? <Text style={styles.groupPlan}> / {money(planned)}</Text> : null}
      {planned > 0 ? <Text style={[styles.groupPlan, overStyle(spent, planned)]}> ({pct(spent, Math.round(planned))})</Text> : null}
    </MaskedTotal>
  );
  /** a header's % with the amounts hidden: of its plan, or of all the spending without one */
  const headerPct = (spent: number, planned: number) => (planned > 0 ? pct(spent, Math.round(planned)) : pct(spent, stats.spent_minor));

  /** a row's "% плана" (its limit as on the right) or "% трат", while the amounts are hidden */
  const hiddenShare = (c: CategoryStat, plan: ReturnType<NonNullable<typeof norms>['byCategory']['get']>) => {
    const lim = !plan ? 0 : plan.kind === 'fixed' ? plan.monthLimit
      : plan.rhythm === 'month' ? 0 : isPartOfWindow(plan.window, range) ? plan.windowNorm : plan.periodNorm;
    return lim > 0 ? `${pct(c.spent_minor, Math.round(lim))} плана` : `${pct(c.spent_minor, stats.spent_minor)} трат`;
  };

  /** "/ limit ₾ (%)" after a category's spending, or null */
  const ofLimitOf = (c: CategoryStat, plan: ReturnType<NonNullable<typeof norms>['byCategory']['get']>) => {
    // "/ limit (%)": the period's own limit; a rhythm's window (a cut week) too when its spending is just this
    // period's — measured over other days it would read against the wrong amount
    // an obligatory payment: its month's plan, when what was paid differs from it
    if (plan?.kind === 'fixed') {
      const paid = (c.category_id !== null && norms?.monthToDate.get(c.category_id)) || 0;
      if (plan.monthLimit <= 0 || Math.round(paid) === Math.round(plan.monthLimit) || paid !== c.spent_minor) return null;
      return <Text style={styles.ofLimit}>{'\u00a0/\u00a0'}{m(plan.monthLimit)}{c.spent_minor > 0 ? <Text style={overStyle(c.spent_minor, plan.monthLimit)}>{` (${pct(c.spent_minor, Math.round(plan.monthLimit))})`}</Text> : GLYPH_ROOM}</Text>;
    }
    if (plan?.kind !== 'limit' || plan.rhythm === 'month') return null;
    const { spent, limit: lim } = limitPair(plan, c);
    if (lim <= 0) return null;
    // no "(0%)" while nothing is spent
    return <Text style={styles.ofLimit}>{'\u00a0/\u00a0'}{m(lim)}{spent > 0 ? <Text style={overStyle(spent, lim)}>{` (${pct(spent, Math.round(lim))})`}</Text> : GLYPH_ROOM}</Text>;
  };
  /**
   * What a day / week limit's "spent / limit" on the right is measured over: the period itself, or — a day of a
   * weekly limit — its whole week so far, as the line under it ("Неделя 5 – 11 окт: осталось …")
   */
  const limitPair = (plan: NonNullable<ReturnType<NonNullable<typeof norms>['byCategory']['get']>>, c: CategoryStat) => {
    const whole = isPartOfWindow(plan.window, range);
    return whole ? { spent: plan.windowSpent, limit: plan.windowNorm } : { spent: c.spent_minor, limit: plan.periodNorm };
  };
  /** the limit on the right: a fixed payment's month plan, a day / week limit's own (see limitPair) */
  const rightLimit = (c: CategoryStat, plan: ReturnType<NonNullable<typeof norms>['byCategory']['get']>) =>
    (!plan ? 0 : plan.kind === 'fixed' ? plan.monthLimit : plan.kind === 'limit' && plan.rhythm !== 'month' ? limitPair(plan, c).limit : 0);
  /** the spending on the right: the limit's own (a week's on a day of a weekly limit), else the period's */
  const rightSpent = (c: CategoryStat, plan: ReturnType<NonNullable<typeof norms>['byCategory']['get']>) =>
    (plan?.kind === 'limit' && plan.rhythm !== 'month' ? limitPair(plan, c).spent : c.spent_minor);

  /** a row with just the name and the period's spending (no limit to judge it by): tap opens its operations */
  const plainRow = (c: CategoryStat, withType = false) => (
    <TouchableOpacity key={String(c.category_id)} style={styles.row} onPress={() => openTransactions(c.category_id, range)} accessibilityHint="Показать операции категории за период">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: c.color }]} />
        <Text style={styles.name} numberOfLines={1}>{withType ? categoryLabel(c) : `${c.emoji || ''} ${c.name}`.trim()}</Text>
        <Text style={[styles.amount, styles.amountPad]}>{hidden ? headerPct(c.spent_minor, 0) : `${money(c.spent_minor)}${GLYPH_ROOM}`}</Text>
      </View>
    </TouchableOpacity>
  );

  /** a category's row: tap opens its operations in the period; a limit's line has its ⓘ */
  const rowOf = (c: CategoryStat, _i?: number, _all?: CategoryStat[], noBar = false, plainAmount = false, withType = false) => {
    // noBar: in a limits section of several categories the section's bar shows them all
    // plainAmount: outside the period's own limit sections (a month's overspend) — just the spending on the right, and
    // no bar either (no limit left to draw it against)
    const plan = c.category_id === null ? undefined : norms?.byCategory.get(c.category_id);
    const mtd = (c.category_id !== null && norms?.monthToDate.get(c.category_id)) || 0;
    const name = withType ? categoryLabel(c) : `${c.emoji || ''} ${c.name}`.trim();
    const ofLimit = plainAmount ? null : ofLimitOf(c, plan);
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
          {/* one line, never wrapped: a wrapped "0 / 106.81 ₾" showed just "0 /" (its second line hidden) */}
          {/* as in the month stats: with a limit the spending without ₾, "/ limit ₾ (%)" muted; "Скрыть суммы": just the
              % — of its limit, or of all spending without one. Separate texts in a row, each measured on its own: one
              nested text was cut short on Android ("0 /", "0 / 106.8…") */}
          {hidden ? <Text style={styles.amount} numberOfLines={1}>{hiddenShare(c, plan)}</Text> : (
            <View style={styles.amountBox}>
              <Text style={[styles.amountText, ofLimit ? overStyle(rightSpent(c, plan), rightLimit(c, plan)) : null]}>{ofLimit ? formatShort(rightSpent(c, plan)) : `${money(c.spent_minor)}${GLYPH_ROOM}`}</Text>
              {ofLimit ? <Text style={[styles.amountText, styles.ofLimit]}>{ofLimit}</Text> : null}
            </View>
          )}
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
          // the month's plan already overspent (by the period's end): no limits any more, just that overspend
          if (plan.monthLimit > 0 && mtd > plan.monthLimit) {
            return (
              <>
                {noBar ? null : <Meter ratio={1} over={plan.monthLimit / mtd} height={8} color={c.color} />}
                <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
                  <Text style={[styles.share, styles.paceText]}>
                    <Text style={[styles.pace, styles.paceAhead]}>Перерасход на {monthIn} {money(mtd - plan.monthLimit)}</Text>
                  </Text>
                  <InfoIcon color={colors.accent} size={INFO_SIZE} />
                </TouchableOpacity>
              </>
            );
          }
          return (
            <>
              {/* the bar is scaled to the bigger of the two: an overspend shows how far past the limit; nothing spent: no bar */}
              {limit > 0 && !noBar && spent > 0 ? (
                spent <= limit ? <Meter ratio={spent / limit} base={others / limit} height={8} color={c.color} />
                  : whole ? <Meter ratio={1} base={others / spent} limitTick={limit / spent} height={8} color={c.color} />
                    : <Meter ratio={1} over={limit / spent} height={8} color={c.color} />
              ) : null}
              <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
                <Text style={[styles.share, styles.paceText]}>
                  {/* as in the month stats: the limit first — how the period moved it: at its start (crossed out) → for
                      the rest of the month after it — then what's left */}
                  {plan.effect ? (() => {
                    const { before, after } = plan.effect;
                    const moved = after !== null && Math.round(after) !== Math.round(before);
                    return (
                      <>
                        {/* "старый → новый": no "Лимит" word, it's plain what it is */}
                        {moved ? <><Text style={styles.crossed}>{m(before)}</Text>{' → '}</> : 'Лимит '}
                        <Text style={moved ? (after! < before ? styles.paceAhead : styles.paceOk) : undefined}>{m(moved ? after! : before)}</Text>
                        {/* no "в неделю": the section says which limit it is */}{'\n'}
                      </>
                    );
                  })() : null}
                  {whole ? windowLabel(plan.rhythm, plan.window) : ''}
                  {limit > 0 ? (
                    <>
                      <Text style={[styles.pace, paceStyle(p)]}>
                        {(left < 0 ? `перерасход ${money(-left)}` : ongoing ? `осталось ${money(left)}` : `сэкономлено ${money(left)}`).replace(/^./, (ch) => (whole && windowLabel(plan.rhythm, plan.window) ? ch : ch.toUpperCase()))}
                      </Text>
                      {left >= 0 && ongoing && rangeDays({ from: whole ? plan.window.from : range.from, to: end }) > 1 ? ` · до ${WEEKDAYS[parseDayKey(end).getDay()]}` : ''}
                    </>
                  ) : `${whole && windowLabel(plan.rhythm, plan.window) ? 'п' : 'П'}лана нет`}
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
              {noBar || bar.ratio <= 0 ? null : <Meter ratio={bar.ratio} base={bar.base} height={8} color={c.color} />}
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
            {/* paid more than planned: an overspend like a limit's — the bar scaled to the spending, a tick at the plan */}
            {plan.monthLimit > 0 && !noBar && mtd > 0 ? (mtd > plan.monthLimit
              ? <Meter ratio={1} over={plan.monthLimit / mtd} height={8} color={c.color} />
              : <Meter ratio={mtd / plan.monthLimit} height={8} color={c.color} />) : null}
            <TouchableOpacity style={styles.paceRow} onPress={() => openInfo({ id: c.category_id!, name })} accessibilityLabel="Как считается категория">
              <Text style={styles.share}>
                {/* "paid / plan" is on the right already; here only what it doesn't say */}
                {plan.monthLimit <= 0 ? `в ${MONTHS_PREP[parseYm(norms!.ym).month]} плана нет`
                  // "paid / plan" on the right: what's still to pay this month, like a limit's "осталось"
                  : ofLimitOf(c, plan) ? (mtd < plan.monthLimit ? <>Осталось оплатить {money(plan.monthLimit - mtd)}<Text> · до {monthEndShort}</Text></> : null)
                    : Math.round(mtd) === Math.round(plan.monthLimit) ? `Оплачено · ${monthIn}`
                      : `${money(mtd)} из ${money(plan.monthLimit)} на ${monthIn}`}
                {/* an overspend, as in every other row */}
                {plan.monthLimit > 0 && mtd > plan.monthLimit ? <Text style={[styles.pace, styles.paceAhead]}>{`${ofLimitOf(c, plan) ? '' : '\n'}Перерасход ${money(mtd - plan.monthLimit)}`}</Text> : null}
              </Text>
              <InfoIcon color={colors.accent} size={INFO_SIZE} />
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.share}>{pct(c.spent_minor, stats.spent_minor)} всех трат</Text>
        )}
      </TouchableOpacity>
    );
  };
  return (
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={cur} />
        </Donut>
      </View>
      {byLimits || (!pace && days <= PACE_MAX_DAYS) || !summary ? null : (
        <TouchableOpacity style={styles.summaryRow} onPress={() => openInfo('summary')} accessibilityLabel="Как считаются траты">
          <Text style={styles.summary}>{summary}</Text>
          <InfoIcon color={colors.accent} size={INFO_SIZE} />
        </TouchableOpacity>
      )}

      {stats.categories.length === 0 ? <Text style={styles.hint}>{emptyText}</Text> : null}
      {/* shorter than a month: the categories by their limit (daily, weekly, …, obligatory), each section with its total
          as the limits' tiles had it; longer: by their sections */}
      {byLimits ? limitSections.map(({ key, cats }) => {
        const g = groups.find((x) => x.key === key);
        const title = GROUP_TITLES[key] === GROUP_TITLES.fixed ? 'Обязательные платежи' : `${GROUP_TITLES[key]} лимиты`;
        const vsLimit = !!g && g.limit > 0;
        const total = g ? g.spent : cats.reduce((a, c) => a + c.spent_minor, 0);
        return (
          <React.Fragment key={key}>
            <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
              <Text style={styles.groupTitle}>{title}</Text>
              {/* one category: its row says it all, the header just names the section */}
              {cats.length > 1 ? (
              <MaskedTotal style={styles.groupTotal} hiddenText={vsLimit ? headerPct(g!.spent, g!.limit) : headerPct(total, 0)}>
                {vsLimit ? <Text style={overStyle(g!.spent, g!.limit)}>{formatShort(Math.round(g!.spent))}</Text> : money(total)}
                {vsLimit ? <Text style={styles.groupPlan}> / {m(g!.limit)}</Text> : null}
                {vsLimit ? <Text style={[styles.groupPlan, overStyle(g!.spent, g!.limit)]}> ({pct(g!.spent, Math.round(g!.limit))})</Text> : null}
              </MaskedTotal>
              ) : null}
            </SectionHeader>
            <View>
              <>
                {/* the section's total only over several categories: with one it repeats its row */}
                {g && cats.length > 1 ? <LimitSummary g={g} /> : null}
                {cats.map((c, i) => rowOf(c, i, cats, cats.length > 1))}
              </>
            </View>
          </React.Fragment>
        );
      }).concat(overspentCats.length ? [(
        <React.Fragment key="overspent">
          <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
            <Text style={styles.groupTitle}>{OVERSPENT}</Text>
            {/* the period's spending of these categories; each row says its month's overspend */}
            {overspentCats.length > 1 ? (
              <MaskedTotal style={styles.groupTotal} hiddenText={headerPct(overspentCats.reduce((a, c) => a + c.spent_minor, 0), 0)}>
                {money(overspentCats.reduce((a, c) => a + c.spent_minor, 0))}
              </MaskedTotal>
            ) : null}
          </SectionHeader>
          <View>
            {overspentCats.map((c, i) => rowOf(c, i, overspentCats, true, true))}
          </View>
        </React.Fragment>
      )] : []).concat(otherCats.length ? [(
        // limits these days can't measure (a weekly one on a day, the month's, obligatory payments): just the spending
        <React.Fragment key="other">
          <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
            <Text style={styles.groupTitle}>{OTHER}</Text>
            {otherCats.length > 1 ? (
              <MaskedTotal style={styles.groupTotal} hiddenText={headerPct(otherCats.reduce((a, c) => a + c.spent_minor, 0), 0)}>
                {money(otherCats.reduce((a, c) => a + c.spent_minor, 0))}
              </MaskedTotal>
            ) : null}
          </SectionHeader>
          <View>
            {otherCats.map((c) => plainRow(c))}
          </View>
        </React.Fragment>
      )] : []) : split.groups.map((g) => (
        <React.Fragment key={`${g.type_id}-${g.title}`}>
          <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {g.categories.length > 1 ? <SectionTotal spent={g.spent_minor} planned={g.categories.reduce((a, c) => a + ((c.category_id !== null && norms?.byCategory.get(c.category_id)?.monthLimit) || 0), 0)} /> : null}
          </SectionHeader>
          <View>
            {g.categories.map(rowOf)}
          </View>
        </React.Fragment>
      ))}
      {/* shorter than a month: the share is the month's limit, these days can't measure it — just the spending */}
      {month && (split.unplanned.length || (month.share > 0 && !byLimits)) ? (
        <>
          <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
            <Text style={styles.groupTitle}>{UNPLANNED}</Text>
            {/* like the limits' headers: the month's spending outside the plan / its share (%) — the share is a month's,
                as an obligatory payment's plan is */}
            {/* one category: no total, its row says it */}
            {byLimits ? (split.unplanned.length > 1 ? (
              <MaskedTotal style={styles.groupTotal} hiddenText={headerPct(split.spent, 0)}>{money(split.spent)}</MaskedTotal>
            ) : null) : <SectionTotal spent={split.spent} planned={month.share} />}
          </SectionHeader>
          <View>
            <>
              {/* the share is a month's limit, drawn like a "крупно, раз в месяц" category's: the month so far, the
                  other days faded, an overspend scaled to the spending with a tick at the share */}
              {month.share > 0 && !byLimits ? (() => {
                const left = Math.round(month.share) - month.spent;
                const others = Math.max(0, month.spent - split.spent);
                return (
                  // on the header's grey band, like a limits section's total
                  <View style={styles.limitSummary}>
                    {/* nothing spent outside the plan this month: no empty bar */}
                    {month.spent <= 0 ? null : month.spent > month.share
                      ? <Meter ratio={1} base={others / month.spent} limitTick={month.share / month.spent} height={8} color={colors.warn} />
                      : <Meter ratio={month.spent / month.share} base={others / month.share} height={8} color={colors.income} />}
                    <Text style={[styles.share, styles.paceText]}>
                      <Text style={[styles.pace, left < 0 ? styles.paceAhead : styles.paceOk]}>
                        {left < 0 ? `Перерасход ${money(-left)}` : `Осталось ${money(left)}`}
                      </Text>
                      {left >= 0 ? ` · до ${monthEndShort}` : ''}
                    </Text>
                  </View>
                );
              })() : null}
              {/* just the spending: no "% всех трат" line under each */}
              {/* outside the plan the rows aren't under their type's section: "Жизнь: Покупки" */}
              {byLimits ? split.unplanned.map((c) => plainRow(c, true)) : split.unplanned.map((c, i, all) => rowOf(c, i, all, false, false, true))}
            </>
          </View>
        </>
      ) : null}
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
                  {g.key === 'outside' && !g.limit ? <>Потрачено <Text style={styles.infoBold}>{money(g.spent)}</Text>.</> : (
                    <>
                      {g.key === 'outside' && g.periodSpent !== undefined ? <>За выбранные дни <Text style={styles.infoBold}>{money(g.periodSpent)}</Text>. </> : null}
                      {g.key === 'fixed' ? 'С 1-го оплачено' : g.key === 'month' || g.key === 'outside' ? 'С 1-го потрачено' : 'Потрачено'} <Text style={styles.infoBold}>{money(g.spent)}</Text> из{' '}
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
                        {g.key === 'fixed' ? `${i.spent >= i.limit ? '✓' : '○'} ` : ''}
                        <Text style={styles.infoBold}>{i.name}</Text>: {g.key === 'fixed' ? 'оплачено' : 'потрачено'} <Code>{money(i.spent)}</Code>,{' '}
                        {g.key === 'month' || g.key === 'fixed' ? <>план <Code>{m(i.limit)}</Code></> : <>лимит <Code>{formula(i.parts)}</Code></>}
                        {g.key === 'fixed' && i.spent > i.limit ? <Text style={styles.paceAhead}> — перерасход {money(i.spent - i.limit)}</Text> : null}.{noPlan(i.parts)}{'\n'}
                      </React.Fragment>
                    ))}
                    {g.items.length > 1 ? <>Итого: <Code>{money(g.spent)} из {g.items.map((i) => m(i.limit)).join(' + ')} = {m(g.limit)}</Code>.</> : null}
                  </Text>
                )}
                {g.overspent?.length ? (
                  // their month's plan is overspent: no limit left, every lari would read as this block's overspend
                  <Text style={styles.infoText}>
                    Не входят — план месяца уже превышен, лимита не осталось:{'\n'}
                    {g.overspent.map((o) => (
                      <React.Fragment key={o.id}>
                        <Text style={styles.infoBold}>{o.name}</Text>: <Text style={styles.paceAhead}>перерасход на {monthIn} {money(o.over)}</Text>{'\n'}
                      </React.Fragment>
                    ))}
                  </Text>
                ) : null}
                {g.key === 'day' || g.key === 'week' || g.key === '2weeks' ? (
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
    </StickyScrollView>
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
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  summary: { flexShrink: 1, fontSize: 14, color: colors.text, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupPlan: { color: colors.muted },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  pace: { fontWeight: '600' },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  paceOver: { color: colors.danger },
  // the section's total under its title, on the same grey band: apart from the category rows below
  limitSummary: { gap: 2, marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, backgroundColor: colors.surface },
  stackWrap: { marginTop: 6, marginBottom: 4 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 },
  stackRest: { backgroundColor: chart.meterTrack },
  stackTick: { position: 'absolute', top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.text },
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  paceText: { flexShrink: 1 },
  paceNeutral: { color: colors.text },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  // the amount never wraps ("0 /" with the limit cut off): the name gives way
  // no tabular-nums here: Android under-measures such text and cut "0 / 106.81 ₾" to "0 /"
  amount: { flexShrink: 0, marginLeft: 8, fontSize: 13, color: colors.text },
  amountBox: { flexShrink: 0, flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 },
  // a bit of room after the last glyph: "₾" comes from a fallback font Android doesn't measure, and was cut off
  amountText: { fontSize: 13, color: colors.text, paddingRight: 2 },
  amountPad: { paddingRight: 2 },
  // "/ plan" like the spending before it: one amount pair
  ofLimit: { color: colors.muted },
  overNum: { color: colors.warn },
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
