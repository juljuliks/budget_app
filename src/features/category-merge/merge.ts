import { mergeCategories } from '@/db/mergeCategories';
import { emitTransactionsChanged } from '@/events';

/** Several categories into the first one, named and typed anew; throws MergeNameTakenError for a name in use. */
export async function mergeInto(...args: Parameters<typeof mergeCategories>) {
  await mergeCategories(...args);
  emitTransactionsChanged();
}
