import React from 'react';
import { StyleSheet } from 'react-native';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import Page from '@/shared/ui/Page';
import { useMerchantActions } from './model/useMerchantActions';
import { useMerchantCard } from './model/useMerchantCard';
import MerchantCategories from './ui/MerchantCategories';
import MerchantHead from './ui/MerchantHead';

type Props = {
  merchantId: string;
  /** leaves the page: the merchant saved or deleted (gone meanwhile too) */
  onClose: () => void;
  /** "N операций · X ₾ ›" and "Показать все ›": the operations searched by its name */
  onShowOperations: (name: string) => void;
  /** its latest operations (the page passes them: an operations entity) */
  recent?: React.ReactNode;
};

/**
 * A merchant's page: its operations (a link to them), its category — one, "Без категории", or several, picked in
 * "Сменить" (a long press picks several) — and its latest operations. "Сохранить" (pinned at the bottom) says what a
 * change means first (no question for a merchant getting its first category or none).
 */
export default function MerchantView({ merchantId, onClose, onShowOperations, recent }: Props) {
  const card = useMerchantCard(merchantId, undefined, onClose);
  const { m, mixed, dirty } = card;
  const { saving, save, remove } = useMerchantActions(merchantId, card, onClose);
  if (!m) return <Loading />;

  return (
    <Page contentStyle={styles.content} footer={(
      <SheetActions
        style={styles.actions}
        submit={{ title: 'Сохранить', onPress: save, disabled: !dirty || saving }}
        extra={[{ title: 'Удалить мерчанта', danger: true, onPress: remove }]}
      />
    )}>
      <MerchantHead m={m} onShowTransactions={() => onShowOperations(m.name)} />
      <MerchantCategories
        categories={card.categories}
        mixed={mixed}
        single={card.single}
        list={card.list}
        saving={saving}
        chooseOne={card.chooseOne}
        chooseSeveral={card.chooseSeveral}
      />
      {recent}
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14 },
  actions: { marginTop: 0 },
});
