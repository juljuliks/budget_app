import React, { useState } from 'react';
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';
import { shortRange } from '@/shared/lib/dateRange';
import { BarMark, clusterMarks, ShownMark } from '../model/monthPace';
import { markStyles as s } from './markStyles';

/** a badge's width: the marks nearer than it are one */
const BADGE = 26;
/** the icons of payments drawn as one: each next this much further, over the one before */
const STEP = 14;
/** more than this many in one: these icons and their count */
const MAX_ICONS = 4;
export const MARK_STATUS = { paid: 'оплачен', missed: 'не оплачен', ahead: 'впереди' } as const;

/** centred on its place; at the bar's ends kept inside it */
const edge = (at: number, width: number, w: number) => ({ marginLeft: width ? Math.min(Math.max(-w / 2, -at * width), (1 - at) * width - w) : -w / 2 });

type Props = {
  marks: BarMark[];
  /** the mark tapped (its key): outlined */
  picked?: string | null;
  /** a tap on a mark: its payments named under the bar (MarkInfo); the same one again — null */
  onPick?: (m: ShownMark | null) => void;
};

/**
 * Over the month's bar, its payments with a day: their category's icon where the plan expects their day on the bar
 * (monthPace), ✓ paid, ✕ the day past and not paid, faded — still ahead. Those too near — one mark: every one's icon,
 * overlapping (more than MAX_ICONS — their count), the worst state. A tap names its payments under the bar.
 */
export default function BarMarks({ marks, picked, onPick }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // the width known (laid out): those too near — one; the place itself is a share of the bar
  const shown = clusterMarks(marks, width ? BADGE / width : 0, width ? STEP / width : 0);
  return (
    <View style={s.row} onLayout={onLayout}>
      {shown.map((m) => {
        const day = shortRange({ from: m.day, to: m.day });
        const icons = m.members.slice(0, MAX_ICONS);
        const w = BADGE + (icons.length - 1) * STEP;
        const on = m.key === picked;
        return (
          <TouchableOpacity
            key={m.key} style={[s.mark, { left: `${Math.min(1, m.at) * 100}%`, width: w }, edge(m.at, width, w)]}
            onPress={() => onPick?.(on ? null : m)} hitSlop={6} accessibilityRole="button"
            accessibilityLabel={m.count > 1 ? `${m.count} платежа с ${day}` : `${m.name}, ${day}, ${MARK_STATUS[m.status]}`}
          >
            <View style={[s.stack, { width: w }]}>
              {icons.map((i, n) => (
                <View key={i.key} style={[s.badge, s.stacked, { left: n * STEP }, i.status === 'ahead' && !on && s.ahead, on && s.picked]}>
                  <Text style={s.icon}>{i.emoji}</Text>
                </View>
              ))}
              {m.count > MAX_ICONS ? <View style={s.count}><Text style={s.countText}>{m.count}</Text></View> : null}
              {m.status === 'ahead' ? null : (
                <View style={[s.status, m.status === 'paid' ? s.paid : s.missed]}>
                  <Text style={s.statusText}>{m.status === 'paid' ? '✓' : '✕'}</Text>
                </View>
              )}
            </View>
            <View style={s.stem} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
