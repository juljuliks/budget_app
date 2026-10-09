import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { PER_PERIOD, SPENDING_PATTERN } from '@/shared/lib/strings';
import { CategoryNorm, flatOf, isPartOfWindow, limitChange, paceOf, rhythmBar } from '@/stats/norms';
import type { PeriodView } from '../model/periodView';
import { capitalize, RHYTHM_LEN } from '../model/periodText';
import Code from './Code';
import { paceName, paceStyle, styles } from './styles';

/** A category's limit in plain words, with its real numbers; the formulas folded under "Как посчитано". */
export default function CategoryInfo({ v, id, p }: { v: PeriodView; id: number; p: CategoryNorm }) {
  const [calcOpen, setCalcOpen] = useState(false);
  const { range, norms, monthIn, money, m } = v;
  const mtd = norms!.monthToDate.get(id) ?? 0;
  const inPeriod = v.stats.categories.find((c) => c.category_id === id)?.spent_minor;
  // a flexible category is checked over the viewed days, a month-rhythm one over the month so far
  const byMonth = p.rhythm === 'month';
  // a day of a weekly limit: the whole week
  const byWindow = !byMonth && isPartOfWindow(p.window, range);
  const norm = byMonth || byWindow ? p.windowNorm : p.periodNorm;
  const spent = byMonth || byWindow ? p.windowSpent : inPeriod ?? p.periodSpent;
  const parts = byMonth || byWindow ? p.windowParts : p.periodParts;
  const pace = paceOf(spent, norm, mtd, p.monthLimit);
  const bar = rhythmBar(p, range, Math.min(p.windowSpent, inPeriod ?? 0));
  // the limit vs the plan's flat share, shown when more than 5% off
  const flat = byMonth ? norm : flatOf(parts);
  const change = byMonth ? null : limitChange(norm, flat);
  const week = p.rhythm === 'week';
  const whole = byMonth ? `план на ${monthIn}` : byWindow ? `лимит на ${week ? 'неделю' : '2 недели'} ${shortRange(p.window)}` : `лимит на ${shortRange(range)}`;
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
        {byMonth ? ' С 1-го потрачено' : byWindow ? ` За ${week ? 'неделю' : '2 недели'} потрачено` : ' Потрачено'} <Text style={styles.infoBold}>{money(spent)}</Text> —{' '}
        <Text style={[styles.infoBold, paceStyle(pace)]}>{v.delta(spent, norm)}</Text>.
      </Text>
      <Text style={styles.infoText}>
        <Text style={styles.infoBold}>Прогресс</Text>{byMonth
          ? <> — весь {monthIn}:{bar.base > 0 ? ' бледная часть — траты в другие дни, яркая — за выбранный период.' : ' заполнение — сколько плана потрачено.'}</>
          : byWindow ? ` — вся ${week ? 'неделя' : 'пара недель'}: бледная часть — траты в другие дни, яркая — за выбранный период. При перерасходе полоса — все траты, черта — лимит.`
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
      <TouchableOpacity onPress={() => setCalcOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: calcOpen }}>
        <Text style={styles.calcToggle}>{calcOpen ? 'Скрыть расчёт ⌃' : 'Как посчитано ›'}</Text>
      </TouchableOpacity>
      {calcOpen ? (
        <>
          {p.effect && p.effect.after !== null && p.rhythm !== 'month' ? (
            <Text style={styles.infoText}>
              Лимит после периода — что осталось от плана на {monthIn} после трат с 1-го по {shortRange({ from: range.to, to: range.to })}, на
              оставшиеся дни: <Code>({m(p.monthLimit)} − {m(mtd)}) / {daysInMonth(norms!.ym) - Number(range.to.slice(8, 10))} × {RHYTHM_LEN[p.rhythm]} = {m(p.effect.after)}</Code>.
            </Text>
          ) : null}
          <Text style={styles.infoText}>
            Лимит считается из плана по тому, как вы тратите («{SPENDING_PATTERN[p.rhythm].title.toLowerCase()}», задаётся в плане){byMonth ? (
              <> — весь план на {monthIn}: <Code>{m(p.monthLimit)}</Code>.</>
            ) : (
              <>
                {' '}— что осталось от плана месяца, делится на оставшиеся дни месяца и умножается на дни {byWindow ? (week ? 'недели' : 'двух недель') : 'периода'}: перерасход раньше в месяце уменьшает лимит, экономия увеличивает. Каждый месяц считается своим планом:{' '}
                <Code>{v.formula(parts)}</Code>.{v.noPlan(parts)}
              </>
            )}
          </Text>
          <Text style={styles.infoText}>
            Цвет: <Code>{m(spent)} {spent <= Math.round(norm) ? '≤' : '>'} {m(norm)}</Code>
            {pace === 'ok' ? null : (
              <>, с 1-го <Code>{m(mtd)} {mtd <= p.monthLimit ? '≤' : '>'} {m(p.monthLimit)}</Code></>
            )}{' '}
            → <Text style={[styles.infoBold, paceStyle(pace)]}>{paceName(pace)}</Text>.
          </Text>
        </>
      ) : null}
    </>
  );
}
