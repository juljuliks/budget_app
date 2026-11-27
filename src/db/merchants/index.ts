// The "Мерчанты" screen's data: merchants of purchases / payments, their activity and categories; their writes.
import { getMerchant, listMerchants } from './reads';
import {
  addMerchantCategory,
  deleteMerchants,
  merchantCategories,
  merchantFollowers,
  merchantsCategoryPreview,
  removeMerchantCategory,
  replaceMerchantCategories,
  setMerchantCategory,
  setMerchantMixed,
  setMerchantsCategory,
} from './writes';

export * from './reads';
export * from './writes';

export default {
  listMerchants,
  getMerchant,
  setMerchantCategory,
  merchantFollowers,
  setMerchantMixed,
  merchantCategories,
  replaceMerchantCategories,
  addMerchantCategory,
  removeMerchantCategory,
  setMerchantsCategory,
  merchantsCategoryPreview,
  deleteMerchants,
};
