import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import TextLink from '@/shared/ui/TextLink';
import { useCategoryFund } from '../model/useCategoryFund';
import { FUND_CARD } from '../texts';
import FundForecastBox from './FundForecastBox';
import FundSheet from './FundSheet';
import { space } from '@/shared/theme/tokens';

/**
 * A category's page, a fund's one: will it make it by its date (no budget this month — not said), «Копилка: взносы и
 * траты ›» — its card. How much by when is set in «В плане» («Копилка» → «Настроить»); nothing without an open fund.
 */
export default function FundSection({ categoryId }: { categoryId: number }) {
  const data = useCategoryFund(categoryId);
  const [card, setCard] = useState(false);
  if (!data?.allowed || !data.month?.fund) return null;
  return (
    <>
      {data.forecast ? <FundForecastBox forecast={data.forecast} fund={data.month.fund} label={data.label} /> : null}
      <TextLink label={FUND_CARD} onPress={() => setCard(true)} containerStyle={styles.card} />
      <FundSheet
        categoryId={card ? categoryId : null}
        label={data.label}
        onClose={() => setCard(false)}
        onEdit={() => setCard(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space[12] },
});
