// A bank on or off ("Банки"): saved, passed to the native side (it reads SMS and pushes while the app is closed).
import { enabledBanks, setBankEnabled } from '@/db/banks';
import type { BankId } from '@/domain/banks';
import { emitTransactionsChanged } from '@/domain/events';
import { setNativeBanks } from '@/native/bankSources';

export async function toggleBank(id: BankId, on: boolean): Promise<BankId[]> {
  const ids = await setBankEnabled(id, on);
  setNativeBanks(ids);
  // the balances, the banks' labels and filter follow
  emitTransactionsChanged();
  return ids;
}

/** On start: the native side told again which banks are on (a restored copy, a fresh install). */
export async function syncNativeBanks(): Promise<void> {
  setNativeBanks(await enabledBanks());
}
