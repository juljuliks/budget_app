import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Category, getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import { hasMerchantCharges } from '@/db/recurring';
import SwitchRow from '@/shared/ui/SwitchRow';
import { switchSubscriptions } from '../model/subscriptionsSwitch';

const HINT_ON = 'Каждый мерчант категории — отдельная подписка: сумма, как часто, следующее списание. План категории считается из них.';
const HINT_OFF = 'Следить за списаниями мерчантов, как у Netflix или страховки: подписка делается из операции.';

/**
 * A category's page: "Подписки" — its merchants' subscriptions followed by their charges; only for a category with
 * merchants' charges (purchases, payments), not a system or a transfer one.
 */
export default function SubscriptionsSwitch({ categoryId }: { categoryId: number }) {
  const [c, setC] = useState<Category | null>(null);
  const [merchants, setMerchants] = useState(false);
  const load = useCallback(() => {
    Promise.all([getCategory(categoryId), hasMerchantCharges(categoryId)])
      .then(([x, m]) => { setC(x ?? null); setMerchants(m); }).catch((e) => console.error('load category failed', e));
  }, [categoryId]);
  useEffect(load, [load]);
  // only where there are merchants to follow (on — always: to turn it off)
  if (!c || isSystemCategory(c) || isTransferCategory(c) || (!c.by_merchant && !merchants)) return null;
  const on = !!c.by_merchant;
  return (
    <SwitchRow
      label="Подписки" hint={on ? HINT_ON : HINT_OFF} on={on} style={styles.row}
      onChange={(v) => { switchSubscriptions(categoryId, v, load).catch((e) => console.error('subscriptions switch failed', e)); }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0, marginTop: 16 },
});
