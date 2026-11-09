import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategoryPickerModal } from '@/entities/category';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { openCategoryTrend, RootStackParamList } from '@/shared/navigation/navigation';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import Loading from '@/shared/ui/Loading';
import SectionBand from '@/shared/ui/SectionBand';
import TextLink from '@/shared/ui/TextLink';
import { trendLists, TrendRow as Row } from './model/trendsView';
import { useTrendsData } from './model/useTrendsData';
import TrendRow from './parts/TrendRow';
import { styles } from './parts/styles';
import { ALL_CATEGORIES, LESS, MODE_HINT, MORE, NO_CHANGES, PICK_TITLE, TOO_EARLY } from './texts';

type Props = NativeStackScreenProps<RootStackParamList, 'Trends'>;

/**
 * «Динамика трат» (the icon by the eye in the stats): this month so far against the usual — the categories
 * spent most above it and below it, each with its bars; «Все категории ›» picks any one. A category — its own page.
 */
export default function TrendsScreen(_: Props) {
  const [picking, setPicking] = useState(false);
  const currency = useDisplayCurrency();
  const { data, failed, load } = useTrendsData(currency);
  const today = dayKeyOf(new Date());
  const lists = useMemo(() => (data ? trendLists(data, today) : null), [data, today]);
  if (!lists) return <Loading failed={failed} onRetry={load} />;

  const section = (title: string, rows: Row[]) => (
    <>
      <View style={styles.pad}><SectionBand title={title} inset={16} /></View>
      {rows.length === 0 ? <Text style={styles.empty}>{NO_CHANGES}</Text>
        : rows.map((r) => <TrendRow key={r.category.id} row={r} currency={currency} />)}
    </>
  );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.pad}>
        <Text style={styles.hint}>{lists.early ? TOO_EARLY : MODE_HINT}</Text>
      </View>
      {lists.early ? null : (
        <>
          {section(MORE, lists.more)}
          {section(LESS, lists.less)}
        </>
      )}
      <TextLink label={ALL_CATEGORIES} onPress={() => setPicking(true)} containerStyle={styles.allLink} />
      <CategoryPickerModal
        visible={picking}
        title={PICK_TITLE}
        onClose={() => setPicking(false)}
        onPick={(id) => { setPicking(false); if (id !== null) openCategoryTrend(id); }}
      />
    </ScrollView>
  );
}
