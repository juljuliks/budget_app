// The merchants' writes: each one tells the screens the data changed.
import { deleteMerchants, setMerchantsCategory } from '@/db/merchants';
import { emitTransactionsChanged } from '@/events';

/** Their operations stay with their categories, without a merchant; new SMS from them make them again. */
export async function removeMerchants(ids: string[]) {
  await deleteMerchants(ids);
  emitTransactionsChanged();
}

/** One category for these merchants: new operations get it, the past ones that followed them change with it. */
export async function saveMerchantsCategory(ids: string[], categoryId: number) {
  await setMerchantsCategory(ids, categoryId);
  emitTransactionsChanged();
}
