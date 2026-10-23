// The merchant card's writes: each one tells the screens the data changed.
import { replaceMerchantCategories, setMerchantCategory, setMerchantMixed } from '@/db/merchants';
import { emitTransactionsChanged } from '@/domain/events';
import { removeMerchants } from '@/entities/merchant';

/** Of different categories, with exactly this list: the first is the primary category new operations get. */
export async function saveMixed(merchantId: string, list: number[]) {
  await setMerchantMixed(merchantId, true);
  await replaceMerchantCategories(merchantId, list);
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
export const removeMerchant = (merchantId: string) => removeMerchants([merchantId]);
