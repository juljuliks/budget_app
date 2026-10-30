import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { longDay, MONTHS_NOM } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { RootStackParamList, showOperationsFrom } from '@/shared/navigation/navigation';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import Loading from '@/shared/ui/Loading';
import Masked from '@/shared/ui/Masked';
import Segmented from '@/shared/ui/Segmented';
import TextLink from '@/shared/ui/TextLink';
import type { TrendMode } from '@/stats/trends';
import { categoryTrendView } from './model/categoryTrendView';
import { Bar, pctText, whyText } from './model/trendsView';
import { useTrendsData } from './model/useTrendsData';
import CategoryTrendDetails from './parts/CategoryTrendDetails';
import { detailStyles as s } from './parts/detailStyles';
import { styles } from './parts/styles';
import TrendBars from './parts/TrendBars';
import { MODES, NOT_COMPARED, SPENT_WHEN, TAP_BAR, TOO_EARLY } from './texts';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryTrend'>;

/** "28 октября", "сентябрь 2026": a bar's day or month. */
const barName = (b: Bar) => (b.key.length > 7 ? longDay(b.key) : `${MONTHS_NOM[Number(b.key.slice(5)) - 1]} ${b.key.slice(0, 4)}`);

/**
 * A category's dynamics («Динамика · ☕ Кафе»): this week / month against its usual, the chart (a tap — that day's or
 * month's sum), why, its weekdays, its months, its merchants, its operations of the period.
 */
export default function CategoryTrendScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [mode, setMode] = useState<TrendMode>(route.params.mode ?? 'week');
  const [picked, setPicked] = useState<number | null>(null);
  const currency = useDisplayCurrency();
  const hidden = useHideAmounts();
  const { data, failed, load } = useTrendsData(currency);
  const today = dayKeyOf(new Date());
  const v = useMemo(() => (data ? categoryTrendView(data, id, mode, today) : null), [data, id, mode, today]);
  useEffect(() => { if (v) navigation.setOptions({ title: `Динамика · ${v.label}` }); }, [navigation, v]);
  if (!v) return <Loading failed={failed || (data !== null && !v)} onRetry={load} />;

  const money = (minor: number) => formatWithCurrency(Math.round(Math.abs(minor)), currency);
  const t = v.trend;
  const line = !v.category.compared ? NOT_COMPARED : !t ? TOO_EARLY[mode]
    : hidden ? pctText(t) : `обычно ${money(t.usual)} · ${pctText(t)}`;
  const bar = picked === null ? null : v.bars[picked];
  const point = !bar ? TAP_BAR[mode] : bar.value === null ? `${barName(bar)} — ещё впереди`
    : `${barName(bar)}: ${money(bar.value)}${bar.usual !== undefined ? ` · обычно ${money(bar.usual)}` : ''}`;
  const pick = (m: TrendMode) => { setMode(m); setPicked(null); };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, styles.pad]}>
      <Segmented options={MODES} value={mode} onChange={pick} style={styles.modes} />
      <View style={s.head}>
        <Text><Masked style={s.spent}>{money(t?.cur ?? 0)}</Masked><Text style={s.spentWhen}>{` ${SPENT_WHEN[mode]}`}</Text></Text>
        {t && v.category.compared && !hidden ? <Text style={s.delta}>{`${t.delta >= 0 ? '+' : '−'}${money(t.delta)}`}</Text> : null}
      </View>
      <Text style={s.line}>{line}</Text>
      <View style={s.chart}>
        <TrendBars bars={v.bars} color={v.category.color} height={140} picked={picked} onPick={setPicked} accessibilityLabelOf={barName} />
      </View>
      <Text style={s.point}>{hidden && bar ? barName(bar) : point}</Text>
      <CategoryTrendDetails v={v} mode={mode} why={t && v.category.compared && !hidden ? whyText(t, money) : null} money={money} />
      <View style={s.operations}>
        <TextLink
          label={`${v.count} ${plural(v.count, ['операция', 'операции', 'операций'])} ${SPENT_WHEN[mode]}`}
          onPress={() => showOperationsFrom({ category: id, range: v.window })}
        />
      </View>
    </ScrollView>
  );
}
