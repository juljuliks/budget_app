// The databases tests start from: the end-to-end flows (seed.ts writes one to a file for the emulator) and the screens'
// tests (__tests__/screens, on the in-memory database). Each fills the current database; `done()` then marks every
// operation read except the ones made unread. Dates are around today.
import { getDb } from '../../src/db';
import { createCategory, findCategoryByName, updateCategory } from '../../src/db/categories';
import { currentYm, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { addManualTransaction, markTransactionsSeen } from '../../src/db/transactions';
import { backfillRule, createRule } from '../../src/categorize';

export const now = new Date();
/** this month: the 1st, `hour` o'clock (the operations come before any of today's) */
const thisMonth = (hour: number) => Math.floor(new Date(now.getFullYear(), now.getMonth(), 1, hour).getTime() / 1000);
/** two months back, the 10th */
const pastMonth = (hour: number) => Math.floor(new Date(now.getFullYear(), now.getMonth() - 2, 10, hour).getTime() / 1000);

/** operations left unread (no category, not opened): the others are marked seen */
const unread = new Set<number>();

export async function buy(merchant: string, lari: number, at: number, categoryId: number | null = null,
  opts: { kind?: 'purchase' | 'payment' | 'refund' | 'deposit' | 'transfer' | 'withdrawal'; currency?: string; unread?: boolean; note?: string } = {}) {
  const kind = opts.kind ?? 'purchase';
  const id = await addManualTransaction({ amount_minor: Math.round(lari * 100), currency: opts.currency ?? 'GEL', category_id: categoryId, occurred_at: at, kind: kind === 'payment' ? 'purchase' : kind });
  if (kind === 'payment') await (await getDb()).run("UPDATE transactions SET kind = 'payment' WHERE id = ?", [id]);
  // a manual one is created seen: a bank one isn't until opened
  if (opts.unread) { unread.add(id); await (await getDb()).run('UPDATE transactions SET seen_at = NULL WHERE id = ?', [id]); }
  if (opts.note) await (await getDb()).run('UPDATE transactions SET note = ? WHERE id = ?', [opts.note, id]);
  // from the bank (an SMS): the balance and the list treat manual ones apart
  await (await getDb()).run("UPDATE transactions SET bank = 'tbc', raw_sms = ? WHERE id = ?", [`${merchant} ${lari}`, id]);
  // as if from an SMS: the merchant and its key
  await (await getDb()).run("UPDATE transactions SET raw_merchant = ?, merchant_key = ?, category_source = CASE WHEN category_id IS NULL THEN NULL ELSE 'user' END WHERE id = ?",
    [merchant, merchant.toUpperCase(), id]);
  return id;
}
/** the merchant's category: its operations follow it */
export async function rule(merchant: string, categoryId: number) {
  await createRule('exact', merchant, categoryId);
  await backfillRule('exact', merchant, categoryId);
  // its operations of that category follow it (as the rule had picked them), the hand-picked ones of others stay
  await (await getDb()).run("UPDATE transactions SET category_source = 'rule' WHERE merchant_key = ? AND category_id = ?", [merchant.toUpperCase(), categoryId]);
}

/** the default categories exist already: those are reused (with this emoji), the rest created */
export async function category(name: string, emoji: string) {
  const existing = await findCategoryByName(name, null);
  if (!existing) return createCategory(name, emoji, null);
  await updateCategory(existing.id, { name, emoji, typeId: null });
  return existing.id;
}

/** The default database (see the top of the file). */
export async function base() {
  const shop = await category('Покупки', '🛍️');
  await category('Одежда', '👕');
  await category('Техника', '💻');
  const empty = await category('Пустая', '📦');
  const food = await category('Продукты', '🛒');

  await buy('ZARA', 100, pastMonth(12));
  await buy('APPLE', 900, pastMonth(13));
  await buy('OLDSHOP', 40, pastMonth(14));
  await buy('ZARA', 200, thisMonth(10));
  await buy('ZARA', 50, thisMonth(11));
  await buy('HM', 80, thisMonth(12));
  await buy('WOLT', 30, thisMonth(13), shop); // hand-picked
  await buy('SPAR', 25, thisMonth(14));
  for (const m of ['ZARA', 'APPLE', 'HM']) await rule(m, shop);
  await rule('OLDSHOP', empty);
  await rule('SPAR', food);
  await setPlanAmount(currentYm(), shop, 50000);
}

/** Only the default categories: what a new install has (SMS flows fill it). */
export async function empty() {}

/** unix seconds `days` ago at noon */
export const daysAgo = (days: number) => Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).getTime() / 1000);

/**
 * 1.6, 8.1: merchants with a category (SPAR exactly, WOLT… by prefix), one of different categories (GLOVO), a person
 * with a rule (it must not apply to a transfer), purchases at TEMU 10 days ago and OLDSHOP 100 days ago (for refunds).
 */
export async function autoCategory() {
  const db = await getDb();
  const food = await category('Продукты', '🛒');
  const cafe = await category('Кафе и рестораны', '☕️');
  const shop = await category('Покупки', '🛍️');
  await rule('SPAR', food);
  await createRule('prefix', 'WOLT', cafe);
  await createRule('exact', 'NINO B', cafe);
  await db.run("INSERT INTO mixed_merchants (merchant_key, created_at) VALUES ('GLOVO', 0)");
  for (const c of [cafe, food]) await db.run("INSERT INTO merchant_categories (merchant_key, category_id) VALUES ('GLOVO', ?)", [c]);
  await buy('TEMU.COM', 60, daysAgo(10), shop);
  await db.run("UPDATE transactions SET merchant_key = 'TEMU COM' WHERE raw_merchant = 'TEMU.COM'");
  await buy('OLDSHOP', 40, daysAgo(100), shop);
}

/** unix seconds: `days` ago at `hour` */
export const at = (days: number, hour: number) => Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour).getTime() / 1000);

/**
 * Section 2 (the operations): today (a purchase of a merchant's category, an unread transfer, a refund, a deposit, money
 * moved to savings), yesterday (a hand-picked one with a note, an unread one with a note), 3 days ago (two of ZARA,
 * one in dollars), 60 older ones of MARKET (paging), one last year.
 */
export async function ops() {
  const db = await getDb();
  const food = await category('Продукты', '🛒');
  const cafe = await category('Кафе и рестораны', '☕️');
  const clothes = await category('Одежда', '👕');
  const subs = await category('Подписки', '📺');
  const savings = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'savings'"))!.id;
  // a time of today that has passed even early in the morning
  const t = (h: number) => Math.min(at(0, h), Math.floor(Date.now() / 1000) - 60 * (12 - h));
  await buy('SPAR', 30, t(9), food);
  await buy('NINO B', 10, t(8), null, { kind: 'transfer', unread: true });
  await buy('ZARA', 5, t(7), clothes, { kind: 'refund' });
  await buy('SALARY', 100, t(6), null, { kind: 'deposit' });
  await buy('Сбережения', 50, t(5), savings, { kind: 'transfer' });
  await buy('WOLT', 45, at(1, 13), cafe, { note: 'обед ещё раз' });
  await buy('GLOVO', 20, at(1, 12), null, { unread: true, note: 'подарок маме' });
  await buy('ZARA', 120, at(3, 18), clothes);
  await buy('ZARA', 80, at(3, 17), clothes);
  await buy('NETFLIX.COM', 10, at(3, 16), subs, { currency: 'USD' });
  for (let i = 0; i < 60; i++) await buy('MARKET', 3 + (i % 7), at(10 + Math.floor(i / 3), 10 + (i % 3)), food);
  await buy('OLDSHOP', 15, Math.floor(new Date(now.getFullYear() - 1, now.getMonth(), 15, 12).getTime() / 1000), clothes);
  await rule('SPAR', food);
  await rule('ZARA', clothes);
  await rule('MARKET', food);
}

/** After a seed: every operation read but the ones made unread. */
export async function done() {
  const db = await getDb();
  const all = await db.all<{ id: number }>('SELECT id FROM transactions');
  await markTransactionsSeen(all.map((r) => r.id).filter((id) => !unread.has(id)));
  unread.clear();
}

/** unix seconds: that day of this month (`m` months back), at `hour` */
export const on = (day: number, hour = 12, m = 0) => Math.floor(new Date(now.getFullYear(), now.getMonth() - m, day, hour).getTime() / 1000);

/**
 * Sections 5–7 (the stats, the plan, the report), for "today" = the 15th (the screens' tests fix it). This month: a
 * budget of 3 000 ₾ (300 locked 🔒, 10% outside the plan), Продукты a limit per day (620), Кафе per week (310), Одежда per
 * month (400, overspent), Дом and Подписки obligatory (800 paid, 30 not), Такси and Развлечения without a plan; last month
 * planned too (for its report), the one before without a plan.
 */
export async function planned() {
  const food = await category('Продукты', '🛒');
  const cafe = await category('Кафе и рестораны', '☕️');
  const home = await category('Дом и коммуналка', '🏠');
  const clothes = await category('Одежда', '👕');
  const subs = await category('Подписки', '📺');
  const taxi = await category('Такси', '🚕');
  const fun = await category('Развлечения', '🎮');
  const ym = currentYm();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // this month
  await setPlanBudget(ym, 300000, 'GEL', 10, true, 30000);
  await setPlanAmount(ym, food, 62000, 'limit', 'GEL', 'day');
  await setPlanAmount(ym, cafe, 31000, 'limit', 'GEL', 'week');
  await setPlanAmount(ym, home, 80000, 'fixed', 'GEL', 'month');
  await setPlanAmount(ym, clothes, 40000, 'limit', 'GEL', 'month');
  await setPlanAmount(ym, subs, 3000, 'fixed', 'GEL', 'month');
  for (let day = 1; day <= 14; day++) await buy('SPAR', 20, on(day, 10), food);
  await buy('SPAR', 25, on(15, 9), food);
  await buy('WOLT', 40, on(6, 13), cafe);
  await buy('WOLT', 50, on(13, 13), cafe);
  await buy('RENT', 800, on(3, 10), home, { kind: 'payment' });
  await buy('ZARA', 450, on(10, 15), clothes);
  await buy('BOLT', 60, on(11, 22), taxi);
  await buy('CINEMA', 300, on(12, 20), fun);
  await buy('NINO B', 20, on(14, 11), null, { kind: 'transfer' });
  await buy('IKEA', 15, on(14, 12), null, { kind: 'refund' });
  await buy('SALARY', 3000, on(1, 9), null, { kind: 'deposit' });

  // last month: planned, Кафе overspent, 200 outside the plan without a share for it
  await setPlanBudget(prev, 300000, 'GEL', 0, true, 0);
  await setPlanAmount(prev, food, 60000, 'limit', 'GEL', 'day');
  await setPlanAmount(prev, cafe, 30000, 'limit', 'GEL', 'week');
  await setPlanAmount(prev, home, 80000, 'fixed', 'GEL', 'month');
  await buy('SPAR', 500, on(5, 10, 1), food);
  await buy('WOLT', 350, on(6, 13, 1), cafe);
  await buy('RENT', 800, on(3, 10, 1), home, { kind: 'payment' });
  await buy('BOLT', 200, on(9, 22, 1), taxi);

  // two months back: spending, no plan
  await buy('SPAR', 400, on(5, 10, 2), food);
  for (const m of ['SPAR', 'ZARA']) await rule(m, m === 'SPAR' ? food : clothes);
}
