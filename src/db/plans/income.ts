// What came in during a month: a hint for its budget («Пришло за месяц», «В среднем за 6 мес приходило»).
import { getDb } from '../index';
import { Currency, dateKey, ensureRatesLater, makeConverter } from '../fx';
import { BUDGET_CURRENCY, monthRange, parseYm } from './months';
import { convertSpending, spendRows, sumBy } from './spend';
import { ymBefore } from './funds';

/**
 * What came in this month, in `currency` (each on its day's rate): a hint for the amount to distribute. The deposits in
 * "Пополнение счёта", and each transfer category that brought in more than was sent (a person paying back more).
 */
export async function monthIncome(ym: string, currency: Currency = BUDGET_CURRENCY): Promise<number> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const rows = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    `SELECT amount_minor, currency, occurred_at FROM transactions
      WHERE kind = 'deposit' AND occurred_at >= ? AND occurred_at < ? AND category_id = (SELECT id FROM categories WHERE system = 'topup')`,
    [from, to],
  );
  await ensureRatesLater(rows.filter((r) => r.currency !== currency).map((r) => dateKey(r.occurred_at)));
  const conv = await makeConverter();
  const topUp = rows.reduce((s, r) => s + (conv(r.amount_minor, r.currency, currency, dateKey(r.occurred_at)) ?? 0), 0);
  const transferIds = new Set(
    (
      await db.all<{ id: number }>(
        'SELECT c.id FROM categories c JOIN category_types ct ON ct.id = c.type_id WHERE ct.is_transfer = 1',
      )
    ).map((c) => c.id),
  );
  const { items } = await convertSpending(
    (await spendRows(from, to)).filter((r) => r.category_id !== null && transferIds.has(r.category_id)),
    currency,
  );
  const net = sumBy(items, (r) => r.category_id);
  return topUp + [...net.values()].reduce((s, v) => s + Math.max(0, -v), 0);
}

/** What came in a month on average over the 6 months before `ym` (those with anything in); null — none had. */
export async function averageIncome(ym: string, currency: Currency = BUDGET_CURRENCY): Promise<number | null> {
  const got: number[] = [];
  for (let m = ymBefore(ym), i = 0; i < 6; m = ymBefore(m), i++) {
    const v = await monthIncome(m, currency);
    if (v > 0) got.push(v);
  }
  return got.length ? Math.round(got.reduce((a, v) => a + v, 0) / got.length) : null;
}
