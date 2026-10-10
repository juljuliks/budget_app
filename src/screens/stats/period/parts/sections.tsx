// The period's sections. Plain functions returning fragments, not components: StickyScrollView sticks the
// SectionHeaders it finds among its children and opened fragments only.
import React from 'react';
import { Text, View } from 'react-native';
import { GROUP_TITLES } from '@/entities/plan';
import { formatPercent } from '@/shared/lib/format';
import { formatShort } from '@/shared/lib/money';
import { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { SectionHeader } from '@/shared/ui/StickyScrollView';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { PeriodView } from '../model/periodView';
import { OTHER, OVERSPENT, UNPLANNED } from '../model/periodText';
import { CategoryRow, PlainRow } from './CategoryRow';
import LimitSummary from './LimitSummary';
import SectionTotal from './SectionTotal';
import { overStyle, styles } from './styles';
import type { Handlers } from './types';

const header = (title: string, total: React.ReactNode) => (
  <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
    <Text style={styles.groupTitle}>{title}</Text>
    {total}
  </SectionHeader>
);

/** Just the spending of several categories (one: its row says it all, the header only names the section). */
const plainTotal = (v: PeriodView, spent: number, several: boolean) => (several ? (
  <MaskedTotal style={styles.groupTotal} hiddenText={v.headerPct(spent, 0)}>{v.money(spent)}</MaskedTotal>
) : null);

/**
 * Shorter than a month: the categories by their limit (daily, weekly, …), each section with its total; then the
 * month's overspend and the limits these days can't measure.
 */
export function limitSections(v: PeriodView, h: Handlers) {
  const limits = v.limitSections.map(({ key, cats }) => {
    const g = v.groups.find((x) => x.key === key);
    const title = GROUP_TITLES[key] === GROUP_TITLES.fixed ? 'Обязательные платежи' : `${GROUP_TITLES[key]} лимиты`;
    const vsLimit = !!g && g.limit > 0;
    const total = g ? g.spent : v.sumSpent(cats);
    return (
      <React.Fragment key={key}>
        {header(title, cats.length > 1 ? (
          <MaskedTotal style={styles.groupTotal} hiddenText={vsLimit ? v.headerPct(g!.spent, g!.limit) : v.headerPct(total, 0)}>
            {vsLimit ? <Text style={overStyle(g!.spent, g!.limit)}>{formatShort(Math.round(g!.spent))}</Text> : v.money(total)}
            {vsLimit ? <Text style={styles.groupPlan}> / {v.m(g!.limit)}</Text> : null}
            {vsLimit ? <Text style={[styles.groupPlan, overStyle(g!.spent, g!.limit)]}> ({formatPercent(g!.spent, Math.round(g!.limit))})</Text> : null}
          </MaskedTotal>
        ) : null)}
        <View>
          {/* the section's total only over several categories: with one it repeats its row */}
          {g && cats.length > 1 ? <LimitSummary v={v} g={g} onInfo={() => h.openInfo({ group: g.key })} /> : null}
          {cats.map((c) => <CategoryRow key={String(c.category_id)} v={v} h={h} c={c} noBar={cats.length > 1} />)}
        </View>
      </React.Fragment>
    );
  });
  const overspent = v.overspentCats.length ? [(
    <React.Fragment key="overspent">
      {/* as its rows: the month's spending of these categories against their month's plans */}
      {header(OVERSPENT, v.overspentCats.length > 1 ? (
        <SectionTotal
          v={v}
          spent={v.overspentCats.reduce((a, c) => a + v.monthToDate(c), 0)}
          planned={v.overspentCats.reduce((a, c) => a + (v.planOf(c)?.monthLimit ?? 0), 0)}
        />
      ) : null)}
      <View>
        {v.overspentCats.map((c) => <CategoryRow key={String(c.category_id)} v={v} h={h} c={c} noBar />)}
      </View>
    </React.Fragment>
  )] : [];
  const other = v.otherCats.length ? [(
    // limits these days can't measure (a weekly one on a day, the month's, obligatory payments): just the spending
    <React.Fragment key="other">
      {header(OTHER, plainTotal(v, v.sumSpent(v.otherCats), v.otherCats.length > 1))}
      <View>
        {v.otherCats.map((c) => <PlainRow key={String(c.category_id)} v={v} h={h} c={c} />)}
      </View>
    </React.Fragment>
  )] : [];
  return [...limits, ...overspent, ...other];
}

/** A month or longer: the categories by their sections (types), as in the month stats. */
export function typeSections(v: PeriodView, h: Handlers) {
  return v.split.groups.map((g) => (
    <React.Fragment key={`${g.type_id}-${g.title}`}>
      {header(g.title, g.categories.length > 1 ? (
        <SectionTotal v={v} spent={g.spent_minor} planned={g.categories.reduce((a, c) => a + (v.planOf(c)?.monthLimit || 0), 0)} />
      ) : null)}
      <View>
        {g.categories.map((c) => <CategoryRow key={String(c.category_id)} v={v} h={h} c={c} />)}
      </View>
    </React.Fragment>
  ));
}

/**
 * "Вне плана": the categories without a plan this month and the uncategorized. Shorter than a month: the share is the
 * month's limit, these days can't measure it — just the spending.
 */
export function unplannedSection(v: PeriodView, h: Handlers) {
  const { month, split, byLimits } = v;
  if (!month || !(split.unplanned.length || (month.share > 0 && !byLimits))) return null;
  const left = Math.round(month.share) - month.spent;
  const others = Math.max(0, month.spent - split.spent);
  return (
    <>
      {/* like the limits' headers: the month's spending outside the plan / its share (%) — the share is a month's, as an
          obligatory payment's plan is; one category: no total, its row says it */}
      {header(UNPLANNED, byLimits ? plainTotal(v, split.spent, split.unplanned.length > 1) : <SectionTotal v={v} spent={split.spent} planned={month.share} />)}
      <View>
        {/* the share is a month's limit, drawn like a "крупно, раз в месяц" category's: the month so far, the other days
            faded, an overspend scaled to the spending with a tick at the share; on the header's grey band */}
        {month.share > 0 && !byLimits ? (
          <View style={styles.limitSummary}>
            {/* nothing spent outside the plan this month: no empty bar */}
            {month.spent <= 0 ? null : month.spent > month.share
              ? <Meter ratio={1} base={others / month.spent} limitTick={month.share / month.spent} height={8} color={colors.warn} />
              : <Meter ratio={month.spent / month.share} base={others / month.share} height={8} color={colors.income} />}
            <Text style={[styles.share, styles.paceText]}>
              <Text style={[styles.pace, left < 0 ? styles.paceAhead : styles.paceOk]}>
                {left < 0 ? `Перерасход ${v.money(-left)}` : `Осталось ${v.money(left)}`}
              </Text>
              {left >= 0 ? ` · до ${v.monthEndShort}` : ''}
            </Text>
          </View>
        ) : null}
        {/* just the spending: no "% всех трат" line under each; outside the plan the rows aren't under their type's section */}
        {split.unplanned.map((c) => (byLimits
          ? <PlainRow key={String(c.category_id)} v={v} h={h} c={c} withType />
          : <CategoryRow key={String(c.category_id)} v={v} h={h} c={c} withType />))}
      </View>
    </>
  );
}
