import React, { useEffect, useState } from 'react';
import { attachSheetHost, CLOSED, detachSheetHost, SheetState } from '@/shared/navigation/sheets';
import { AddTransactionSheet } from '@/features/add-transaction';
import { CategoryDeleteSheet } from '@/features/category-delete';
import { CategoryTypesSheet } from '@/features/category-types';
import { TransactionSheet } from '@/features/transaction-edit';
import { MonthReportSheet } from '@/features/month-report';
import { MerchantCard } from '@/features/merchant-card';
import { SettingsSheet } from '@/features/settings';
import { startSmsImport } from '@/features/sms-import';

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
      <SettingsSheet open={state.settings} onClose={() => close({ settings: false })} onImportSms={startSmsImport} />
      {/* over the operation it was opened from; "Показать операции" closes that one too */}
      <MerchantCard merchantId={state.merchant} onClose={() => close({ merchant: null })} onLeave={() => close({ transaction: null })} />
    </>
  );
}
