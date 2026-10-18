import React from 'react';
import { StyleSheet } from 'react-native';
import type { CategoryInfo } from '@/entities/category';
import { showOperationsFromSheet } from '@/shared/navigation/navigation';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { useMerchantActions } from './model/useMerchantActions';
import { useMerchantCard } from './model/useMerchantCard';
import MerchantCategories from './ui/MerchantCategories';
import MerchantHead from './ui/MerchantHead';

type Props = {
  /** null = closed */
  merchantId: string | null;
  /** the categories' labels (the merchants screen has them); without, the card loads them */
  categories?: Map<number, CategoryInfo>;
  onClose: () => void;
};

/**
 * A merchant's card (bottom sheet): its operations, "Разные категории", and the categories right in it — the merchant's
 * one or "Без категории", or, of different categories, several (offered for its operations); "Сохранить" says what a
 * change means first (no question for a merchant getting its first category or none).
 */
export default function MerchantCard({ merchantId, categories: given, onClose }: Props) {
  const card = useMerchantCard(merchantId, given, onClose);
  const { m, mixed, dirty } = card;
  const { saving, save, remove } = useMerchantActions(merchantId, card, onClose);

  // the Transactions tab searching this merchant's name; back returns here (and to what the card was over)
  function showTransactions() {
    if (m) showOperationsFromSheet({ query: m.name });
  }

  return (
    <BottomSheet visible={merchantId !== null} onClose={onClose} style={styles.sheet}>
      {!m ? null : (
        <SheetScrollView contentContainerStyle={styles.content}>
          <MerchantHead m={m} mixed={mixed} saving={saving} onShowTransactions={showTransactions} onSwitchMixed={card.switchMixed} />
          <MerchantCategories
            name={m.name}
            savedCategoryId={m.category_id}
            categories={card.categories}
            mixed={mixed}
            single={card.single}
            list={card.list}
            saving={saving}
            toggle={card.toggle}
            setSingle={card.setSingle}
          />
          <SheetActions
            submit={{ title: 'Сохранить', onPress: save, disabled: !dirty || saving }}
            extra={[{ title: 'Удалить мерчанта', danger: true, onPress: remove }]}
          />
        </SheetScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%', minHeight: 200, paddingBottom: 0 },
  content: { padding: 16, paddingBottom: 24 },
});
