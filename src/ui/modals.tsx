import React, { useEffect, useState } from 'react';
import { attachSheetHost, CLOSED, detachSheetHost, SheetState } from '../sheets';
import AddTransactionSheet from './AddTransactionSheet';
import CategoryDeleteSheet from './CategoryDeleteSheet';
import CategoryTypesSheet from './CategoryTypesSheet';
import TransactionSheet from './TransactionSheet';

export { openAddTransaction, openCategoryDelete, openCategoryTypes, openTransaction } from '../sheets';

/** Shows the sheets over the pages (see sheets.ts); mounted once in App. */
export function ModalHost() {
  const [state, setState] = useState<SheetState>(CLOSED);
  useEffect(() => {
    const update = (patch: Partial<SheetState>) => setState((s) => ({ ...s, ...patch }));
    update(attachSheetHost(update));
    return detachSheetHost;
  }, []);
  const close = (patch: Partial<SheetState>) => setState((s) => ({ ...s, ...patch }));

  return (
    <>
      <TransactionSheet txId={state.transaction} onClose={() => close({ transaction: null })} />
      <AddTransactionSheet visible={state.addTransaction} onClose={() => close({ addTransaction: false })} />
      <CategoryTypesSheet visible={state.categoryTypes} onClose={() => close({ categoryTypes: false })} />
      <CategoryDeleteSheet categoryId={state.categoryDelete} onClose={() => close({ categoryDelete: null })} />
    </>
  );
}
