import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Donut from '@/shared/ui/Donut';
import Masked from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import ProgressRing from '@/shared/ui/ProgressRing';
import { chart, colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';
import Frame from './Frame';

const SEGMENTS = [
  { key: 'savings', value: 50, color: chart.savings },
  { key: 'rent', value: 13, color: colors.accent },
  { key: 'food', value: 10, color: colors.accentSoft },
  { key: 'other', value: 27, color: colors.border },
];

/** Charts: meters, rings, the donut; an amount hidden by 👁. */
export default function ChartsDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <Frame name="Meter" note="полоса: доля, отметка лимита, перерасход">
        <Meter ratio={0.4} />
        <Meter ratio={0.8} marker={0.6} height={10} />
        <Meter ratio={1} over={0.2} limitTick={0.9} height={10} />
      </Frame>
      <Frame name="ProgressRing" note="кольцо прогресса копилки">
        <View style={styles.row}>
          <ProgressRing ratio={0.25} color={colors.accent} track={colors.border} />
          <ProgressRing ratio={0.7} color={chart.savings} track={colors.border} size={40} thickness={6} />
        </View>
      </Frame>
      <Frame name="Donut" note="бюджет по категориям; тап — выбор сегмента">
        <Donut segments={SEGMENTS} selectedKey={selected} onSelect={setSelected} size={160}>
          <Text style={styles.center}>10 410 ₾</Text>
        </Donut>
      </Frame>
      <Frame name="Masked" note="сумма, которую 👁 скрывает">
        <Masked style={styles.amount}>2 771.77 ₾</Masked>
      </Frame>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[16] },
  center: { fontSize: font.title, fontWeight: weight.bold, color: colors.text },
  amount: { fontSize: font.headline, fontWeight: weight.bold, color: colors.text },
});
