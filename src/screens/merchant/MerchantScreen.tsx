import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getMerchant } from '@/db/merchants';
import { RecentOperations, useRecentOperations } from '@/entities/transaction';
import { MerchantView } from '@/features/merchant-card';
import { RootStackParamList, showOperationsFrom } from '@/shared/navigation/navigation';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';

type Props = NativeStackScreenProps<RootStackParamList, 'Merchant'>;

/** A merchant's page: its name the header's title, its card, its latest operations ("Показать все ›" — all of them). */
export default function MerchantScreen({ route, navigation }: Props) {
  const key = route.params.key;
  const [name, setName] = useState('');
  const [count, setCount] = useState(0);
  const rows = useRecentOperations({ merchant: key });
  useEffect(() => {
    getMerchant(key).then((m) => {
      if (!m) return;
      setName(m.name);
      setCount(m.count);
      navigation.setOptions({ title: m.name });
    }).catch(toastFailure('load merchant', LOAD_FAILED));
  }, [key, navigation, rows]);
  // all its operations: searched by its name, back returns here
  const showAll = (n = name) => showOperationsFrom({ query: n });
  return (
    <MerchantView
      merchantId={key}
      onClose={() => { if (navigation.canGoBack()) navigation.goBack(); }}
      onShowOperations={showAll}
      recent={<RecentOperations rows={rows} count={count} of="merchant" onShowAll={() => showAll()} />}
    />
  );
}
