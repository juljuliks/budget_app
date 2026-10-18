import React, { useEffect, useRef, useState } from 'react';
import { attachSheetHost, CLOSED, detachSheetHost, SheetState } from '@/shared/navigation/sheets';
import { AddTransactionSheet } from '@/features/add-transaction';
import { CategoryDeleteSheet, startCategoryDelete } from '@/features/category-delete';
import { CategoryTypesSheet } from '@/features/category-types';
import { TransactionSheet } from '@/features/transaction-edit';
import { MonthReportSheet } from '@/features/month-report';
import { MonthCloseSheet } from '@/features/month-close';
import { PaymentHost } from '@/features/recurring-payments';
import { CategorySheet } from '@/entities/category';
import { MerchantCard } from '@/features/merchant-card';
import { BackupSheet, PasswordHost } from '@/features/backup';
import { LockOptionsSheet } from '@/features/app-lock';

/** Shows the sheets over the pages (see sheets.ts); mounted once in App. */
export function ModalHost() {
  const [state, setState] = useState<SheetState>(CLOSED);
  // what is open now, for a link that leaves the sheets for a page (sheets.ts: leaveSheets)
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    const update = (patch: Partial<SheetState>) => setState((s) => ({ ...s, ...patch }));
    const take = () => { const was = current.current; setState(CLOSED); return was; };
    update(attachSheetHost({ patch: update, take }));
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
      <MonthCloseSheet ym={state.monthClose} onClose={() => close({ monthClose: null })} />
      <BackupSheet visible={state.backup} onClose={() => close({ backup: false })} />
      <LockOptionsSheet visible={state.lockOptions} onClose={() => close({ lockOptions: false })} />
      {/* over the operation or the plan it was opened from */}
      <PaymentHost which={state.payment} onClose={() => close({ payment: null })} />
      {/* over the operation or the plan's sheet it was opened from, or the categories page */}
      {state.category !== null ? (
        <CategorySheet
          visible categoryId={state.category} onClose={() => close({ category: null })}
          onDelete={() => { const id = state.category; if (id !== null) startCategoryDelete(id, { close: () => close({ category: null }), onDeleted: () => {} }); }}
        />
      ) : null}
      {/* the backups' password, asked by the backup's flows */}
      <PasswordHost />
      {/* over the operation it was opened from; "Показать операции" hides both, back shows them again */}
      <MerchantCard merchantId={state.merchant} onClose={() => close({ merchant: null })} />
    </>
  );
}
