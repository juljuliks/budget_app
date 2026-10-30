import React from 'react';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import HistoryView from './HistoryView';

/** Plan and spending by months, a page over the stats («История по месяцам ›»). */
export default function HistoryScreen() {
  return <HistoryView currency={useDisplayCurrency()} />;
}
