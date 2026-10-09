// The line under a category's name: how its limit or its month's plan stands, with its ⓘ.
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { CategoryStat, parseYm } from '@/db/plans';
import { parseDayKey, rangeDays } from '@/shared/lib/dateRange';
import { MONTHS_PREP, WEEKDAYS } from '@/shared/lib/dates';
import { InfoIcon } from '@/shared/ui/icons';
import Meter from '@/shared/ui/Meter';
import { colors } from '@/shared/theme/theme';
import { CategoryNorm, isPartOfWindow, paceOf, rhythmBar } from '@/stats/norms';
import type { PeriodView } from '../model/periodView';
import { ofLimitOf } from './OfLimit';
import { INFO_SIZE, paceStyle, styles } from './styles';

type Props = { v: PeriodView; c: CategoryStat; plan: CategoryNorm; noBar: boolean; onInfo: () => void };

/** The ⓘ line: what the line says and a tap to how it is counted. */
function InfoLine({ onInfo, children, textStyle }: { onInfo: () => void; children: React.ReactNode; textStyle?: object }) {
  return (
    <TouchableOpacity style={styles.paceRow} onPress={onInfo} accessibilityLabel="Как считается категория">
      <Text style={textStyle ?? [styles.share, styles.paceText]}>{children}</Text>
      <InfoIcon color={colors.accent} size={INFO_SIZE} />
    </TouchableOpacity>
  );
}

/**
 * A day / week / 2-week limit. A period shorter than the category's rhythm (a day of a weekly limit) is measured as the
 * whole rhythm window so far: a weekly category is meant to be spent unevenly, a day's share of it would read as overspend.
 */
export function RhythmLine({ v, c, plan, noBar, onInfo }: Props) {
  const mtd = v.monthToDate(c);
  const whole = isPartOfWindow(plan.window, v.range);
  const limit = Math.round(whole ? plan.windowNorm : plan.periodNorm);
  const spent = whole ? plan.windowSpent : c.spent_minor;
  const left = limit - spent;
  const p = paceOf(spent, limit, mtd, plan.monthLimit);
  const end = whole ? plan.window.to : v.range.to;
  const ongoing = end >= v.today;
  // the other days of the window, drawn faded before this period's part
  const others = whole ? Math.max(0, spent - Math.min(c.spent_minor, spent)) : 0;
  const label = whole ? v.windowLabel(plan.rhythm, plan.window) : '';
  // the month's plan already overspent (by the period's end): no limits any more, just that overspend
  if (plan.monthLimit > 0 && mtd > plan.monthLimit) {
    return (
      <>
        {noBar ? null : <Meter ratio={1} over={plan.monthLimit / mtd} height={8} color={c.color} />}
        <InfoLine onInfo={onInfo}>
          <Text style={[styles.pace, styles.paceAhead]}>Перерасход на {v.monthIn} {v.money(mtd - plan.monthLimit)}</Text>
        </InfoLine>
      </>
    );
  }
  const effect = plan.effect;
  const moved = !!effect && effect.after !== null && Math.round(effect.after) !== Math.round(effect.before);
  return (
    <>
      {/* the bar is scaled to the bigger of the two: an overspend shows how far past the limit; nothing spent: no bar */}
      {limit > 0 && !noBar && spent > 0 ? (
        spent <= limit ? <Meter ratio={spent / limit} base={others / limit} height={8} color={c.color} />
          : whole ? <Meter ratio={1} base={others / spent} limitTick={limit / spent} height={8} color={c.color} />
            : <Meter ratio={1} over={limit / spent} height={8} color={c.color} />
      ) : null}
      <InfoLine onInfo={onInfo}>
        {/* as in the month stats: the limit first — how the period moved it: at its start (crossed out) → for the rest
            of the month after it — then what's left */}
        {effect ? (
          <>
            {/* "старый → новый": no "Лимит" word, it's plain what it is */}
            {moved ? <><Text style={styles.crossed}>{v.m(effect.before)}</Text>{' → '}</> : 'Лимит '}
            <Text style={moved ? (effect.after! < effect.before ? styles.paceAhead : styles.paceOk) : undefined}>{v.m(moved ? effect.after! : effect.before)}</Text>
            {/* no "в неделю": the section says which limit it is */}{'\n'}
          </>
        ) : null}
        {label}
        {limit > 0 ? (
          <>
            <Text style={[styles.pace, paceStyle(p)]}>
              {(left < 0 ? `перерасход ${v.money(-left)}` : ongoing ? `осталось ${v.money(left)}` : `сэкономлено ${v.money(left)}`).replace(/^./, (ch) => (label ? ch : ch.toUpperCase()))}
            </Text>
            {left >= 0 && ongoing && rangeDays({ from: whole ? plan.window.from : v.range.from, to: end }) > 1 ? ` · до ${WEEKDAYS[parseDayKey(end).getDay()]}` : ''}
          </>
        ) : `${label ? 'п' : 'П'}лана нет`}
      </InfoLine>
    </>
  );
}

/** "Крупно, раз в месяц": not split by days, the month's plan so far. */
export function MonthLine({ v, c, plan, noBar, onInfo }: Props) {
  const left = Math.round(plan.windowNorm) - plan.windowSpent;
  const p = paceOf(plan.windowSpent, plan.windowNorm, v.monthToDate(c), plan.monthLimit);
  const bar = rhythmBar(plan, v.range, c.spent_minor);
  return (
    <>
      {noBar || bar.ratio <= 0 ? null : <Meter ratio={bar.ratio} base={bar.base} height={8} color={c.color} />}
      <InfoLine onInfo={onInfo}>
        <Text style={[styles.pace, paceStyle(p)]}>
          На {v.monthIn} {left < 0 ? `перерасход ${v.money(-left)}` : `осталось ${v.money(left)}`}
        </Text>
      </InfoLine>
    </>
  );
}

/** A fixed payment: the month's plan, not split by days; "paid / plan" is on the right already. */
export function FixedLine({ v, c, plan, noBar, onInfo }: Props) {
  const mtd = v.monthToDate(c);
  const ofLimit = ofLimitOf(v, c, plan);
  return (
    <>
      {/* paid more than planned: an overspend like a limit's — the bar scaled to the spending, a tick at the plan */}
      {plan.monthLimit > 0 && !noBar && mtd > 0 ? (mtd > plan.monthLimit
        ? <Meter ratio={1} over={plan.monthLimit / mtd} height={8} color={c.color} />
        : <Meter ratio={mtd / plan.monthLimit} height={8} color={c.color} />) : null}
      <InfoLine onInfo={onInfo} textStyle={styles.share}>
        {plan.monthLimit <= 0 ? `в ${MONTHS_PREP[parseYm(v.norms!.ym).month]} плана нет`
          // "paid / plan" on the right: what's still to pay this month, like a limit's "осталось"
          : ofLimit ? (mtd < plan.monthLimit ? <>Осталось оплатить {v.money(plan.monthLimit - mtd)}<Text> · до {v.monthEndShort}</Text></> : null)
            : Math.round(mtd) === Math.round(plan.monthLimit) ? `Оплачено · ${v.monthIn}`
              : `${v.money(mtd)} из ${v.money(plan.monthLimit)} на ${v.monthIn}`}
        {/* an overspend, as in every other row */}
        {plan.monthLimit > 0 && mtd > plan.monthLimit ? <Text style={[styles.pace, styles.paceAhead]}>{`${ofLimit ? '' : '\n'}Перерасход ${v.money(mtd - plan.monthLimit)}`}</Text> : null}
      </InfoLine>
    </>
  );
}
