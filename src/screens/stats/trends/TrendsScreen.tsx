import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategoryPickerModal } from '@/entities/category';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { openCategoryTrend, RootStackParamList } from '@/shared/navigation/navigation';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { colors } from '@/shared/theme/theme';
import Loading from '@/shared/ui/Loading';
import SectionBand from '@/shared/ui/SectionBand';
import Segmented from '@/shared/ui/Segmented';
import TextLink from '@/shared/ui/TextLink';
import type { TrendMode } from '@/stats/trends';
import { trendLists, TrendRow as Row } from './model/trendsView';
import { useTrendsData } from './model/useTrendsData';
import TrendRow from './parts/TrendRow';
import { styles } from './parts/styles';
import { ALL_CATEGORIES, LEGEND_THIS_WEEK, LEGEND_USUAL_DAY, LESS, MODE_HINT, MODES, MORE, NO_CHANGES, PICK_TITLE, TOO_EARLY } from './texts';

type Props = NativeStackScreenProps<RootStackParamList, 'Trends'>;

/**
 * «Динамика трат» (the icon by the eye in the stats): this week or month so far against the usual — the categories
 * spent most above it and below it, each with its bars; «Все категории ›» picks any one. A category — its own page.
 */
export default function TrendsScreen({ route }: Props) {
  const [mode, setMode] = useState<TrendMode>(route.params?.mode ?? 'week');
  const [picking, setPicking] = useState(false);
  const currency = useDisplayCurrency();
  const { data, failed, load } = useTrendsData(currency);
  const today = dayKeyOf(new Date());
  const lists = useMemo(() => (data ? trendLists(data, mode, today) : null), [data, mode, today]);
  if (!lists) return <Loading failed={failed} onRetry={load} />;

  const section = (title: string, rows: Row[]) => (
    <>
      <View style={styles.pad}><SectionBand title={title} inset={16} /></View>
      {rows.length === 0 ? <Text style={styles.empty}>{NO_CHANGES}</Text>
        : rows.map((r) => <TrendRow key={r.category.id} row={r} mode={mode} currency={currency} />)}
    </>
  );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.pad}>
        <Segmented options={MODES} value={mode} onChange={setMode} style={styles.modes} />
        <Text style={styles.hint}>{lists.early ? TOO_EARLY[mode] : MODE_HINT[mode]}</Text>
      </View>
      {lists.early ? null : (
        <>
          {section(MORE, lists.more)}
          {section(LESS, lists.less)}
          {mode === 'week' && lists.more.length + lists.less.length > 0 ? (
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: colors.muted }]} /><Text style={styles.legendText}>{LEGEND_THIS_WEEK}</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: colors.border }]} /><Text style={styles.legendText}>{LEGEND_USUAL_DAY}</Text></View>
            </View>
          ) : null}
        </>
      )}
      <TextLink label={ALL_CATEGORIES} onPress={() => setPicking(true)} containerStyle={styles.allLink} />
      <CategoryPickerModal
        visible={picking}
        title={PICK_TITLE}
        onClose={() => setPicking(false)}
        onPick={(id) => { setPicking(false); if (id !== null) openCategoryTrend(id, mode); }}
      />
    </ScrollView>
  );
}
