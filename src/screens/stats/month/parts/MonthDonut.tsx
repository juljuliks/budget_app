import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { MonthStats, StatGroup } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import { chart } from '@/shared/theme/theme';
import Donut, { DonutSegment } from '@/shared/ui/Donut';
import Segmented from '@/shared/ui/Segmented';
import TextLink from '@/shared/ui/TextLink';
import DonutCenter from '../../parts/DonutCenter';
import { DonutCut, DonutView, donutSlices, type Slice, type SliceInput } from '../model/donutSlices';
import CutTabs from './CutTabs';
import DistributionSheet from './DistributionSheet';
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
 * The month's ring. «Траты» / «План» over it. The ring is half the block wide; beside it the biggest slices,
 * «Подробнее» — «Распределение бюджета», every piece of the plan — under the cut «Категории» / «Разделы». In the hole
 * the total spent of the plan or the budget and what is free (a tap — its sheet); a segment tapped — its slice.
 */
export default function MonthDonut({ stats, plannedAll, input, word, onBudget }: Props) {
  const [view, setView] = useState<DonutView>('spent');
  const [cut, setCut] = useState<DonutCut>('category');
  const [selected, setSelected] = useState<string | null>(null);
  // «Подробнее»: the budget's every piece
  const [more, setMore] = useState(false);
  // the block: the screen less its sides
  const blockWidth = useWindowDimensions().width - 32;
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

  // the ring half the block wide; the hole's text inside its ring
  const ring = Math.floor((blockWidth - 16) / 2);
  const thickness = Math.round(ring * 0.1);
  const hole = ring - 2 * thickness - 24;

  return (
    <View style={styles.donutWrap}>
      {plannedAll > 0 ? <Segmented options={VIEWS} value={shown} onChange={change(setView)} style={styles.donutViews} /> : null}
      {ring ? (
        <View style={styles.donutRow}>
          <Donut
            size={ring} thickness={thickness}
            segments={segments} selectedKey={pickedSlice || pickedCategory ? selected : null} onSelect={pick}
            onCenterPress={plannedAll > 0 ? onBudget : undefined} testID="month-budget"
          >
            {shown === 'plan'
              ? <PlanCenter base={input.base} word={word} free={slices?.find((s) => s.key === 'free')?.value ?? 0} picked={pickedSlice} currency={stats.currency} hole={hole} />
              : <DonutCenter hole={hole} total={stats.spent_minor} currency={stats.currency} of={plannedAll}
                  picked={pickedCategory ?? (pickedSlice && { name: pickedSlice.title, emoji: null, spent_minor: pickedSlice.value })} />}
          </Donut>
          {/* at the right: the cut, what the ring is made of, «Подробнее» — the budget's every piece */}
          <View style={styles.donutSide}>
            <CutTabs value={cut} onChange={change(setCut)} style={styles.donutCuts} />
            <Legend items={items} selected={selected} onPick={(k) => pick(selected === k ? null : k)} onMore={plannedAll > 0 ? () => setMore(true) : undefined} />
          </View>
        </View>
      ) : null}
      <DistributionSheet
        visible={more} onClose={() => setMore(false)} cut={cut} onCut={change(setCut)}
        items={more ? donutSlices('plan', cut, input) ?? [] : []} base={input.base} word={word} currency={stats.currency} onBudget={onBudget}
      />
    </View>
  );
}

/** the legend's rows: the biggest; the rest — one line */
const LEGEND = 5;

type LegendProps = { items: Slice[]; selected: string | null; onPick: (key: string) => void; onMore?: () => void };

/** What the ring is made of, the biggest first (sections in their order), with its share; a tap picks one. */
function Legend({ items, selected, onPick, onMore }: LegendProps) {
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
      {rest.length || onMore ? (
        <View style={styles.donutRestRow}>
          {rest.length ? <Text style={[styles.donutNameText, styles.donutRest]}>{`ещё ${rest.length} · ${formatPercent(rest.reduce((a, s) => a + s.value, 0), total)}`}</Text> : null}
          {onMore ? <TextLink label="Подробнее" onPress={onMore} style={styles.donutMore} containerStyle={styles.donutMoreAt} /> : null}
        </View>
      ) : null}
    </View>
  );
}
