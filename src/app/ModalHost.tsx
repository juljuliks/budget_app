import React, { useEffect, useState } from 'react';
import { attachSheetHost, CLOSED, detachSheetHost, SheetState } from '@/shared/navigation/sheets';
import AddTransactionSheet from '../ui/AddTransactionSheet';
import CategoryDeleteSheet from '../ui/CategoryDeleteSheet';
import CategoryTypesSheet from '../ui/CategoryTypesSheet';
import TransactionSheet from '../ui/TransactionSheet';
import { MonthReportSheet } from '../ui/stats/MonthReport';

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
      <MonthReportSheet ym={state.monthReport} onClose={() => close({ monthReport: null })} />
    </>
  );
}
