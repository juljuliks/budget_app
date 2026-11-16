import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { shortRange } from '@/shared/lib/dateRange';
import { BarMark, clusterMarks } from '../model/monthPace';
import { markStyles as s } from './markStyles';

/** a badge's width: the marks nearer than it are one */
const BADGE = 26;
const STATUS = { paid: 'оплачен', missed: 'не оплачен', ahead: 'впереди' } as const;
/** centred on its place; at the bar's ends kept inside it */
const edge = (at: number, width: number) => ({ marginLeft: width ? Math.min(Math.max(-BADGE / 2, -at * width), (1 - at) * width - BADGE) : -BADGE / 2 });

/**
 * Over the month's bar, its payments with a day: their category's icon where the plan expects their day on the bar
 * (monthPace), ✓ paid, ✕ the day past and not paid, faded — still ahead; those too near — one, with their count.
 */
export default function BarMarks({ marks }: { marks: BarMark[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // the width known (laid out): those too near — one; the place itself is a share of the bar
  const shown = clusterMarks(marks, width ? BADGE / width : 0);
  return (
    <View style={s.row} onLayout={onLayout}>
      {shown.map((m) => {
        const day = shortRange({ from: m.day, to: m.day });
        return (
          <View
            key={m.key} style={[s.mark, { left: `${Math.min(1, m.at) * 100}%` }, edge(m.at, width), m.status === 'ahead' && s.ahead]}
            accessible accessibilityLabel={m.count > 1 ? `${m.count} платежа с ${day}` : `${m.name}, ${day}, ${STATUS[m.status]}`}
          >
            <View style={s.badge}>
              <Text style={s.icon}>{m.emoji}</Text>
              {m.count > 1 ? <View style={s.count}><Text style={s.countText}>{m.count}</Text></View> : null}
              {m.status === 'ahead' ? null : (
                <View style={[s.status, m.status === 'paid' ? s.paid : s.missed]}>
                  <Text style={s.statusText}>{m.status === 'paid' ? '✓' : '✕'}</Text>
                </View>
              )}
            </View>
            <View style={s.stem} />
          </View>
        );
      })}
    </View>
  );
}
