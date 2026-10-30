import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { categoryLabel, categorySummary, getCategory } from '@/db/categories';
import { CategoryView } from '@/entities/category';
import { RecentOperations, useRecentOperations } from '@/entities/transaction';
import { startCategoryDelete } from '@/features/category-delete';
import { SubscriptionsSwitch } from '@/features/recurring-payments';
import { openCategoryTrend, RootStackParamList, showOperationsFrom } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import { TrendsIcon } from '@/shared/ui/icons';
import LinkCard from '@/shared/ui/LinkCard';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;

/** A category's page: its name the header's title, «Динамика трат», its fields, its latest operations ("Показать все ›" — all of them). */
export default function CategoryScreen({ route, navigation }: Props) {
  const id = route.params.id;
  const [count, setCount] = useState(0);
  const rows = useRecentOperations({ category: id });
  useEffect(() => {
    Promise.all([getCategory(id), categorySummary(id)]).then(([c, s]) => {
      setCount(s.count);
      if (c) navigation.setOptions({ title: categoryLabel(c) });
    }).catch(toastFailure('load category', LOAD_FAILED));
  }, [id, navigation, rows]);
  const back = () => { if (navigation.canGoBack()) navigation.goBack(); };
  // its operations: filtered by it, back returns here
  const showAll = () => showOperationsFrom({ category: id });
  return (
    <CategoryView
      categoryId={id}
      onClose={back}
      onShowOperations={showAll}
      links={<LinkCard icon={<TrendsIcon color={colors.accent} />} label="Динамика трат" onPress={() => openCategoryTrend(id)} style={styles.trends} />}
      onDelete={() => startCategoryDelete(id, { close: back, onDeleted: () => {} })}
      extra={<SubscriptionsSwitch categoryId={id} />}
      recent={<RecentOperations rows={rows} count={count} of="category" onShowAll={showAll} />}
    />
  );
}

const styles = StyleSheet.create({
  trends: { marginTop: 12 },
});
