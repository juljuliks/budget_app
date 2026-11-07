import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import TextLink from '@/shared/ui/TextLink';
import { useCategoryFund } from '../model/useCategoryFund';
import { FUND_CARD } from '../texts';
import FundSheet from './FundSheet';

/**
 * A category's page, a fund's one: «Копилка: взносы и траты ›» — its card. How much by when is set in «В плане»
 * («Копилка» → «Настроить»); nothing without an open fund.
 */
export default function FundSection({ categoryId }: { categoryId: number }) {
  const data = useCategoryFund(categoryId);
  const [card, setCard] = useState(false);
  if (!data?.allowed || !data.month?.fund) return null;
  return (
    <>
      <TextLink label={FUND_CARD} onPress={() => setCard(true)} containerStyle={styles.card} />
      <FundSheet categoryId={card ? categoryId : null} label={data.label} onClose={() => setCard(false)} onEdit={() => setCard(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
});
