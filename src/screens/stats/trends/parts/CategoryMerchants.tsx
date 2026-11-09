import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { MerchantLink } from '@/entities/merchant';
import Masked from '@/shared/ui/Masked';
import Segmented from '@/shared/ui/Segmented';
import { MerchantsPeriod, useCategoryMerchants } from '../model/useCategoryMerchants';
import { MERCHANT_PERIODS, MERCHANTS, NO_MERCHANTS } from '../texts';
import { detailStyles as s } from './detailStyles';

/**
 * «Мерчанты» of a category's «Динамика»: the 5 spent at most — this month, this year or all the time (picked over the
 * list; `initial` — the page's own); a tap opens the merchant.
 */
export default function CategoryMerchants({ categoryId, currency, money, initial }: {
  categoryId: number; currency: Currency; money: (minor: number) => string; initial: MerchantsPeriod;
}) {
  const [period, setPeriod] = useState<MerchantsPeriod>(initial);
  const list = useCategoryMerchants(categoryId, currency, period);
  return (
    <View style={s.block}>
      <Text style={s.label}>{MERCHANTS}</Text>
      <Segmented options={MERCHANT_PERIODS} value={period} onChange={setPeriod} style={s.periods} />
      {list?.length === 0 ? <Text style={s.label}>{NO_MERCHANTS}</Text> : null}
      {list?.map((m) => (
        <View key={m.key ?? m.name} style={s.merchant}>
          {m.key ? <MerchantLink merchantKey={m.key} label={m.name} containerStyle={s.merchantName} /> : <Text style={[s.value, s.merchantName]}>{m.name}</Text>}
          <Masked style={s.value}>{money(m.value)}</Masked>
        </View>
      ))}
    </View>
  );
}
