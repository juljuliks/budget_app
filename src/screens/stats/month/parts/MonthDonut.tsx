import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { MonthStats, StatGroup } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import { chart } from '@/shared/theme/theme';
import Chip from '@/shared/ui/Chip';
import Donut, { DonutSegment } from '@/shared/ui/Donut';
import Segmented from '@/shared/ui/Segmented';
import DonutCenter from '../../parts/DonutCenter';
import { DonutCut, DonutView, donutSlices, type Slice, type SliceInput } from '../model/donutSlices';
import PlanCenter from './PlanCenter';
import { styles } from './styles';

/**
 * Donut: one segment per category with spending, in section order, so a type's categories sit next to
 * each other in their palette's shades (src/domain/colors.ts).
 */
function donutSegments(groups: StatGroup[]): DonutSegment[] {
  return groups.flatMap((g) => g.categories)
    .filter((c) => c.spent_minor > 0)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color }));
}

const VIEWS = [['spent', 'Траты'], ['plan', 'План']] as const;

type Props = {
  stats: MonthStats;
  /** the month's plan with the share outside it: "из 3 666 ₾ · 96% ✏️" in the hole (0 — none: no «План») */
  plannedAll: number;
  /** the sections, the share outside the plan, the savings and what the shares are of («бюджета» / «плана») */
  input: SliceInput;
  word: string;
  /** a tap in the hole: the month's budget */
  onBudget: () => void;
};

/**
 * The month's ring. «Траты» / «План» over it: what was spent, or how the budget is planned; under it the cut —
 * «Категории» / «Разделы» (by sections: their names with the share under it). In the hole the total spent of the plan
 * or the budget and what is free (a tap — its sheet); a segment tapped — its category or section.
 */
export default function MonthDonut({ stats, plannedAll, input, word, onBudget }: Props) {
  const [view, setView] = useState<DonutView>('spent');
  const [cut, setCut] = useState<DonutCut>('category');
  const [selected, setSelected] = useState<string | null>(null);
  const shown: DonutView = plannedAll > 0 ? view : 'spent';
  const slices = useMemo(() => donutSlices(shown, cut, input), [shown, cut, input]);
  const segments = useMemo(() => slices
    ? slices.map((s) => ({ key: s.key, value: s.value, color: s.color ?? chart.meterTrack }))
    : donutSegments(stats.groups), [slices, stats]);
  const pickedSlice = selected === null ? undefined : slices?.find((s) => s.key === selected);
  const pickedCategory = selected === null || slices ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  // the legend: the slices, or the categories by spending
  const items: Slice[] = slices ?? stats.categories.filter((c) => c.spent_minor > 0 && c.category_id !== null)
    .map((c) => ({ key: String(c.category_id), title: c.name, emoji: c.emoji, color: c.color, value: c.spent_minor }));
  const pick = (k: string | null) => setSelected(k);
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSelected(null); };

  return (
    <View style={styles.donutWrap}>
      {plannedAll > 0 ? <Segmented options={VIEWS} value={shown} onChange={change(setView)} style={styles.donutViews} /> : null}
      <View style={styles.donutRow}>
        <Donut
          size={RING} thickness={16}
          segments={segments} selectedKey={pickedSlice || pickedCategory ? selected : null} onSelect={pick}
          onCenterPress={plannedAll > 0 ? onBudget : undefined} testID="month-budget"
        >
          {shown === 'plan'
            ? <PlanCenter base={input.base} word={word} free={slices?.find((s) => s.key === 'free')?.value ?? 0} picked={pickedSlice} currency={stats.currency} />
            : <DonutCenter small total={stats.spent_minor} currency={stats.currency} of={plannedAll}
                picked={pickedCategory ?? (pickedSlice && { name: pickedSlice.title, emoji: null, spent_minor: pickedSlice.value })} />}
        </Donut>
        {/* at the right: the cut, then what the ring is made of */}
        <View style={styles.donutSide}>
          <View style={styles.donutCuts}>
            <Chip small soft label="Категории" selected={cut === 'category'} onPress={() => change(setCut)('category')} />
            <Chip small soft label="Разделы" selected={cut === 'section'} onPress={() => change(setCut)('section')} />
          </View>
          <Legend items={items} selected={selected} onPick={(k) => pick(selected === k ? null : k)} />
        </View>
      </View>
    </View>
  );
}

/** the legend's rows: the biggest; the rest — one line */
const LEGEND = 5;
const RING = 160;

/** What the ring is made of, the biggest first (sections in their order), with its share; a tap picks one. */
function Legend({ items, selected, onPick }: { items: Slice[]; selected: string | null; onPick: (key: string) => void }) {
  const total = items.reduce((a, s) => a + s.value, 0);
  const byOrder = items.length > LEGEND ? [...items].sort((a, b) => b.value - a.value) : items;
  const shown = byOrder.slice(0, LEGEND);
  const rest = byOrder.slice(LEGEND);
  return (
    <View style={styles.donutNames}>
      {shown.map((s) => (
        <TouchableOpacity key={s.key} style={[styles.donutName, selected !== null && selected !== s.key && styles.legendDim]} onPress={() => onPick(s.key)} hitSlop={4}>
          <View style={[styles.legendDot, { backgroundColor: s.color ?? chart.meterTrack }]} />
          <Text style={styles.donutNameText} numberOfLines={1}>{`${s.emoji || ''} ${s.title}`.trim()}</Text>
          <Text style={styles.donutNameShare}>{formatPercent(s.value, total)}</Text>
        </TouchableOpacity>
      ))}
      {rest.length ? (
        <Text style={[styles.donutNameText, styles.donutRest]}>
          {`ещё ${rest.length} · ${formatPercent(rest.reduce((a, s) => a + s.value, 0), total)}`}
        </Text>
      ) : null}
    </View>
  );
}
