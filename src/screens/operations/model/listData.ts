// The operations tab's data (its filters: features/operations-filters): the pages it loads, the sections it draws and
// each day's spending for their headers.
import { useEffect, useRef, useState } from 'react';
import {
  GroupKind, listGroupedPage, listTransactionsPage, PageCursor, TransactionGroup, TransactionRow, TxFilter,
} from '@/db/transactions';
import { spendingEntries } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { dayKey, formatDay } from '@/shared/lib/format';
import { groupTitle } from './groups';

/** Every view loads from the database a page at a time while scrolling. */
export const PAGE_SIZE = 50;

/** How the list is split into sections: by day (the feed), or another way (every operation matching the filters at once). */
export type GroupBy = 'day' | GroupKind;
export const GROUP_BY: Array<readonly [GroupBy, string]> = [
  ['day', 'По дням'], ['month', 'По месяцам'], ['merchant', 'По мерчантам'], ['category', 'По категориям'], ['kind', 'По типу'], ['amount', 'По сумме'],
];
export type Row = TransactionRow & { group_key?: string };
export type ListView = { filter: TxFilter; groupBy: GroupBy };
/** Where the next page starts: a keyset cursor by day (new operations don't shift it), an offset in the groups' order. */
export type Next = PageCursor | number | null;

export async function fetchPage(v: ListView, from: Next, limit: number): Promise<{ rows: Row[]; next: Next }> {
  if (v.groupBy === 'day') {
    const p = await listTransactionsPage(typeof from === 'number' ? null : from, limit, v.filter);
    return { rows: p.rows, next: p.nextCursor };
  }
  const offset = typeof from === 'number' ? from : 0;
  const rows = await listGroupedPage(v.filter, v.groupBy, offset, limit);
  return { rows, next: rows.length === limit ? offset + rows.length : null };
}

export type Section = { key: string; title: string; dayStart: number; data: Row[]; group?: TransactionGroup };

/** The rows loaded split into sections: their groups (as far as the rows reach) or their days. */
export function buildSections(rows: Row[], groups: TransactionGroup[] | null, groupBy: GroupBy): Section[] {
  const out: Section[] = [];
  if (groups) {
    const byKey = new Map(groups.map((g) => [g.key, g]));
    for (const r of rows) {
      const key = r.group_key ?? '';
      if (out.length === 0 || out[out.length - 1].key !== key) {
        const g = byKey.get(key);
        out.push({ key, title: g ? groupTitle(g, groupBy as GroupKind) : '', dayStart: 0, data: [], group: g });
      }
      out[out.length - 1].data.push(r);
    }
    return out;
  }
  for (const r of rows) {
    const key = dayKey(r.occurred_at);
    if (out.length === 0 || out[out.length - 1].key !== key) {
      const d = new Date(r.occurred_at * 1000);
      out.push({ key, title: formatDay(r.occurred_at), dayStart: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000, data: [] });
    }
    out[out.length - 1].data.push(r);
  }
  return out;
}

/**
 * Spent per day for the day headers: all of the day's transactions, not only the ones loaded or filtered, converted to
 * the app's currency (Настройки → Валюта); transactions themselves stay in their own currency. Only the operations the
 * list's filters show: a day's total is what its section holds (all of it, not only the rows loaded). Empty when grouped.
 */
export function useDaySpent(sections: Section[], grouped: boolean, currency: Currency, filter: TxFilter): Map<string, number> {
  const [daySpent, setDaySpent] = useState<Map<string, number>>(new Map());
  // a new filter brings new sections: read with them (the filter itself doesn't re-read)
  const filterRef = useRef(filter);
  filterRef.current = filter;
  useEffect(() => {
    if (sections.length === 0 || grouped) { setDaySpent(new Map()); return undefined; }
    const from = sections[sections.length - 1].dayStart;
    const last = new Date(sections[0].dayStart * 1000);
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime() / 1000;
    let stale = false;
    spendingEntries(from, to, currency, filterRef.current).then((rows) => {
      if (stale) return;
      const m = new Map<string, number>();
      for (const r of rows) m.set(dayKey(r.occurred_at), (m.get(dayKey(r.occurred_at)) ?? 0) + r.spent_minor);
      setDaySpent(m);
    }).catch((e) => console.error('day totals failed', e));
    return () => { stale = true; };
  }, [sections, grouped, currency]);
  return daySpent;
}
