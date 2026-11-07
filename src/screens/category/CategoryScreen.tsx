import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { categoryLabel, categorySummary, getCategory, isTransferCategory } from '@/db/categories';
import { CategoryView, ImpulseSwitch } from '@/entities/category';
import { RecentOperations, useRecentOperations } from '@/entities/transaction';
import { startCategoryDelete } from '@/features/category-delete';
import { SubscriptionsSection } from '@/features/recurring-payments';
import { askFundOff, FundSection, FundSetupSheet } from '@/features/fund';
import { PlanKindSection, useCategoryKind } from '@/features/category-kind';
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
  // a transfer category: not spending, no «Динамика трат» (null — not known yet: none shown meanwhile)
  const [transfer, setTransfer] = useState<boolean | null>(null);
  const rows = useRecentOperations({ category: id });
  useEffect(() => {
    Promise.all([getCategory(id), categorySummary(id)]).then(([c, s]) => {
      setCount(s.count);
      setTransfer(!!c && (isTransferCategory(c) || c.system === 'own'));
      if (c) navigation.setOptions({ title: categoryLabel(c) });
    }).catch(toastFailure('load category', LOAD_FAILED));
  }, [id, navigation, rows]);
  const back = () => { if (navigation.canGoBack()) navigation.goBack(); };
  // «В плане»: the kind, its setup; a fund's left — asked off
  const kind = useCategoryKind(id, { fundOff: (label, done) => { askFundOff(id, label, done).catch(toastFailure('fund off', LOAD_FAILED)); } });
  const fundSetup = (
    <FundSetupSheet categoryId={kind.setup === 'fund' ? id : null} label={kind.data?.label ?? ''} onClose={kind.closeSetup} onSaved={kind.setupSaved} />
  );
  // its operations: filtered by it, back returns here
  const showAll = () => showOperationsFrom({ category: id });
  return (
    <CategoryView
      categoryId={id}
      onClose={back}
      onShowOperations={showAll}
      links={transfer !== false ? null : <LinkCard icon={<TrendsIcon color={colors.accent} />} label="Динамика трат" onPress={() => openCategoryTrend(id)} style={styles.trends} />}
      onDelete={() => startCategoryDelete(id, { close: back, onDeleted: () => {} })}
      extra={(
        <>
          <SubscriptionsSection categoryId={id} />
          <PlanKindSection k={kind} fundSetup={fundSetup} />
          <FundSection categoryId={id} />
          <ImpulseSwitch categoryId={id} />
        </>
      )}
      submit={kind.submit}
      recent={<RecentOperations rows={rows} count={count} of="category" onShowAll={showAll} />}
    />
  );
}

const styles = StyleSheet.create({
  trends: { marginTop: 12 },
});
