import React, { useEffect, useState } from 'react';
import { attachSheetHost, CLOSED, detachSheetHost, SheetState } from '@/shared/navigation/sheets';
import { AddTransactionSheet } from '@/features/add-transaction';
import { CategoryDeleteSheet } from '@/features/category-delete';
import { CategoryTypesSheet } from '@/features/category-types';
import { MonthReportSheet } from '@/features/month-report';
import { MonthCloseSheet } from '@/features/month-close';
import { PaymentHost } from '@/features/recurring-payments';
import { BackupSheet, PasswordHost } from '@/features/backup';
import { LockOptionsSheet } from '@/features/app-lock';

/** Shows the sheets (forms, steps) over the pages (see sheets.ts); mounted once in App. */
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
      <AddTransactionSheet visible={state.addTransaction} onClose={() => close({ addTransaction: false })} />
      <CategoryTypesSheet visible={state.categoryTypes} onClose={() => close({ categoryTypes: false })} />
      <CategoryDeleteSheet categoryId={state.categoryDelete} onClose={() => close({ categoryDelete: null })} />
      <MonthReportSheet ym={state.monthReport} onClose={() => close({ monthReport: null })} />
      <MonthCloseSheet ym={state.monthClose} onClose={() => close({ monthClose: null })} />
      <BackupSheet visible={state.backup} onClose={() => close({ backup: false })} />
      <LockOptionsSheet visible={state.lockOptions} onClose={() => close({ lockOptions: false })} />
      {/* over the operation's page or the plan it was opened from */}
      <PaymentHost which={state.payment} onClose={() => close({ payment: null })} />
      {/* the backups' password, asked by the backup's flows */}
      <PasswordHost />
    </>
  );
}
