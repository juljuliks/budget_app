import { txCategoryLabel } from '../db/categories';
import { AMOUNT_BANDS, GroupKind, TransactionGroup } from '../db/transactions';
import { KIND_LABELS } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { MONTHS } from '@/shared/lib/dates';
import { NO_CATEGORY } from '@/shared/lib/strings';

// "По сумме": 1000+, 500+, 100–500, 20–100, до 20
const bandTitle = (i: number) => {
  const from = AMOUNT_BANDS[i] / 100;
  if (i === 0 || i === 1) return `${from}+`;
  return from === 0 ? `До ${AMOUNT_BANDS[i - 1] / 100}` : `${from}–${AMOUNT_BANDS[i - 1] / 100}`;
};

/** A group's section title in the operations list. */
export function groupTitle(g: TransactionGroup, by: GroupKind): string {
  switch (by) {
    case 'merchant': return g.key ? g.raw_merchant ?? g.key : 'Без мерчанта';
    case 'category': return txCategoryLabel(g) ?? NO_CATEGORY;
    case 'month': {
      const [y, m] = g.key.split('-').map(Number);
      return `${MONTHS[m - 1]} ${y}`;
    }
    case 'kind': return KIND_LABELS[g.key] ?? g.key;
    case 'amount': return bandTitle(Number(g.key));
  }
}

/** "−512 ₾ · −20 $": spent minus received, per currency. */
export function groupTotal(g: TransactionGroup): string {
  return g.totals.map(({ currency, total }) => `${total > 0 ? '+' : total < 0 ? '−' : ''}${formatMoneyWithCurrency(Math.abs(total), currency)}`).join(' · ');
}
