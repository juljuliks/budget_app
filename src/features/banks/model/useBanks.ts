import { useCallback, useEffect, useState } from 'react';
import { enabledBanks } from '@/db/banks';
import type { BankId } from '@/domain/banks';
import { onTransactionsChanged } from '@/domain/events';

/** The banks on; `several`: more than one, so the operations say whose they are (a label, the "Банк" filter). */
export function useBanks(): { ids: BankId[]; several: boolean } {
  const [ids, setIds] = useState<BankId[]>(['tbc']);
  const load = useCallback(() => {
    enabledBanks().then(setIds).catch((e) => console.error('load banks failed', e));
  }, []);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { ids, several: ids.length > 1 };
}
