import React from 'react';
import { Text } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { SummaryGroup } from '@/entities/plan';
import { PER_PERIOD } from '@/shared/lib/strings';
import type { PeriodView } from '../model/periodView';
import { GROUP_ABOUT } from '../model/periodText';
import Code from './Code';
import { styles } from './styles';

/** A limits block: its total, what it counts, how the period moved the limit, each category's numbers. */
export default function GroupInfo({ v, g }: { v: PeriodView; g: SummaryGroup }) {
  const { money, m, monthIn } = v;
  const rhythm = g.key === 'day' || g.key === 'week' || g.key === '2weeks';
  const per = rhythm ? PER_PERIOD[g.key as 'day' | 'week' | '2weeks'] : '';
  const after = g.change?.after ?? null;
  return (
    <>
      <Text style={styles.infoText}>
        {g.key === 'outside' && !g.limit ? <>Потрачено <Text style={styles.infoBold}>{money(g.spent)}</Text>.</> : (
          <>
            {g.key === 'outside' && g.periodSpent !== undefined ? <>За выбранные дни <Text style={styles.infoBold}>{money(g.periodSpent)}</Text>. </> : null}
            {g.key === 'fixed' ? 'С 1-го оплачено' : g.key === 'month' || g.key === 'outside' ? 'С 1-го потрачено' : 'Потрачено'} <Text style={styles.infoBold}>{money(g.spent)}</Text> из{' '}
            <Text style={styles.infoBold}>{m(g.limit)}</Text> —{' '}
            <Text style={[styles.infoBold, g.spent > Math.round(g.limit) ? styles.paceAhead : styles.paceOk]}>{v.delta(g.spent, g.limit)}</Text>.
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
          {v.outsideCats.map((c) => (
            <React.Fragment key={String(c.category_id)}>
              {categoryLabel(c)}: <Code>{v.signed(c)}</Code>{v.cameIn(c) ? ' — пришло, не трата' : ''}{'\n'}
            </React.Fragment>
          ))}
        </Text>
      ) : (
        <Text style={styles.infoText}>
          {g.items.map((i) => (
            <React.Fragment key={i.id}>
              {g.key === 'fixed' ? `${i.spent >= i.limit ? '✓' : '○'} ` : ''}
              <Text style={styles.infoBold}>{v.labelOf(i.id, i.name)}</Text>: {g.key === 'fixed' ? 'оплачено' : 'потрачено'} <Code>{money(i.spent)}</Code>,{' '}
              {g.key === 'month' || g.key === 'fixed' ? <>план <Code>{m(i.limit)}</Code></> : <>лимит <Code>{v.formula(i.parts)}</Code></>}
              {g.key === 'fixed' && i.spent > i.limit ? <Text style={styles.paceAhead}> — перерасход {money(i.spent - i.limit)}</Text> : null}.{v.noPlan(i.parts)}{'\n'}
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
              <Text style={styles.infoBold}>{v.labelOf(o.id, o.name)}</Text>: <Text style={styles.paceAhead}>перерасход на {monthIn} {money(o.over)}</Text>{'\n'}
            </React.Fragment>
          ))}
        </Text>
      ) : null}
      {rhythm ? (
        <Text style={styles.infoText}>
          Лимит — что осталось от месячного плана категории, разложенное на оставшиеся дни месяца: перерасход раньше в
          месяце уменьшает его, экономия увеличивает. Каждый месяц считается своим планом.
        </Text>
      ) : null}
    </>
  );
}
