// A fund's card: what went in and out, newest first — "Уже отложено", the months' contributions, its spending.
import { getDb } from '../index';
import { convertSpending } from './spend';
import { currentYm, monthStart } from './months';
import { Fund, fundLedger } from './funds';

export type FundEntry =
  | { type: 'start'; ym: string; minor: number }
  | { type: 'contribution'; ym: string; minor: number; current: boolean }
  /** an operation in the fund's category (its part, if split): `minor` > 0 out, < 0 back (a refund) */
  | { type: 'spend'; ym: string; minor: number; id: number; kind: string; bank: string; raw_merchant: string | null; note: string | null; occurred_at: number };

/** The fund's entries in its currency, newest first. */
export async function fundEntries(fund: Fund, nowYm = currentYm()): Promise<FundEntry[]> {
  const ledger = await fundLedger(fund, nowYm, nowYm);
  const last = ledger.months[ledger.months.length - 1]?.ym;
  const db = await getDb();
  const rows = !last ? [] : await db.all<{ id: number; kind: string; bank: string; raw_merchant: string | null; note: string | null; amount_minor: number; currency: string; occurred_at: number; refund_settled_at: number | null; category_id: number | null }>(
    `SELECT id, kind, bank, raw_merchant, note, amount_minor, currency, occurred_at, refund_settled_at, category_id FROM spend_parts
      WHERE category_id = ? AND occurred_at >= ? AND occurred_at < ?`,
    [fund.category_id, monthStart(fund.since_ym), monthStart(nextMonth(last))]);
  const { items } = await convertSpending(rows, fund.currency);
  const out: FundEntry[] = [];
  for (const m of ledger.months) {
    if (m.ym === fund.since_ym && fund.start_minor > 0) out.push({ type: 'start', ym: m.ym, minor: fund.start_minor });
    if (m.contribution > 0) out.push({ type: 'contribution', ym: m.ym, minor: m.contribution, current: m.ym === nowYm });
    const spent = items.filter((i) => ymOf(i.row.occurred_at) === m.ym).sort((a, b) => a.row.occurred_at - b.row.occurred_at);
    for (const { row, value } of spent) {
      const r = rows.find((x) => x.id === row.id)!;
      out.push({ type: 'spend', ym: m.ym, minor: value, id: r.id, kind: r.kind, bank: r.bank, raw_merchant: r.raw_merchant, note: r.note, occurred_at: r.occurred_at });
    }
  }
  return out.reverse();
}

const ymOf = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
