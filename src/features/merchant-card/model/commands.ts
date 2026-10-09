// The merchant card's writes: each one tells the screens the data changed.
import {
  addMerchantCategory, deleteMerchants, merchantCategories, removeMerchantCategory, setMerchantCategory, setMerchantMixed,
} from '@/db/merchants';
import { emitTransactionsChanged } from '@/events';

/** Of different categories, with exactly this list (each new operation asks among them). */
export async function saveMixed(merchantId: string, list: number[]) {
  await setMerchantMixed(merchantId, true);
  // the list as picked: setMerchantMixed adds the ones its operations had
  const now = (await merchantCategories(merchantId, 1000)).map((c) => c.id);
  for (const id of now) if (!list.includes(id)) await removeMerchantCategory(merchantId, id);
  for (const id of list) if (!now.includes(id)) await addMerchantCategory(merchantId, id);
  emitTransactionsChanged();
}

/**
 * One category (or none): new operations get it; the past ones that followed the old one change with it or keep it.
 * Of different categories and none picked: just not different any more.
 */
export async function saveSingle(merchantId: string, categoryId: number | null, wasMixed: boolean, past: 'change' | 'keep') {
  if (categoryId === null && wasMixed) await setMerchantMixed(merchantId, false);
  else await setMerchantCategory(merchantId, categoryId, past);
  emitTransactionsChanged();
}

/** Its operations stay with their categories, without the merchant. */
export async function removeMerchant(merchantId: string) {
  await deleteMerchants([merchantId]);
  emitTransactionsChanged();
}
