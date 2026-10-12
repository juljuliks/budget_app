// What "Банки" shows of each bank: on or off, its card's balance, its templates, its messages waiting in "Не распознано".
import { useCallback, useEffect, useState } from 'react';
import { cardBalance, CardBalance } from '@/db/balance';
import { enabledBanks } from '@/db/banks';
import { listTemplates, listUnparsed } from '@/db/messages';
import { BANKS, Bank, bankOfSender } from '@/domain/banks';
import { onTransactionsChanged } from '@/domain/events';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

export type BankInfo = { bank: Bank; on: boolean; balance: CardBalance | null; templates: number; unparsed: number };

export function useBanksInfo() {
  const [info, setInfo] = useState<BankInfo[] | null>(null);
  const { failed, started, fail } = useLoadFailed('load banks');
  const load = useCallback(() => {
    started();
    (async () => {
      const on = await enabledBanks();
      const [templates, unparsed] = await Promise.all([listTemplates(), listUnparsed()]);
      setInfo(await Promise.all(BANKS.map(async (bank) => ({
        bank,
        on: on.includes(bank.id),
        balance: await cardBalance(bank.id),
        templates: templates.filter((t) => t.bank === bank.id).length,
        unparsed: unparsed.filter((m) => bankOfSender(m.sender).id === bank.id).length,
      }))));
    })().catch(fail);
  }, [started, fail]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { info, failed, load, setInfo };
}
