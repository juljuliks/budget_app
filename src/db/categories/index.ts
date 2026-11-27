// Categories: their kinds and labels, reads and writes, deleting one (its operations go elsewhere).
import { categoryLabel, isTransferCategory, txCategoryLabel } from './labels';
import {
  createCategory,
  findCategoryByName,
  getCategory,
  incrementCategoryUsage,
  listCategories,
  topCategories,
  updateCategory,
} from './queries';
import {
  countPastTransactionsOfCategory,
  currentTransactionsOfCategory,
  deleteCategory,
  moveTransactionsOutOfCategory,
} from './deletion';

export * from './labels';
export * from './queries';
export * from './deletion';

export default {
  listCategories,
  getCategory,
  findCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  currentTransactionsOfCategory,
  countPastTransactionsOfCategory,
  moveTransactionsOutOfCategory,
  incrementCategoryUsage,
  topCategories,
  isTransferCategory,
  categoryLabel,
  txCategoryLabel,
};
