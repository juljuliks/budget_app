// "Пополнение счёта" and transfers: every deposit goes there (what the month has to distribute, not spending); a transfer
// category is sent minus what came back within the month — "−" spent, "+" (more came back) goes to the month's income.
const displayNotification = jest.fn();
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: (...a: any[]) => displayNotification(...a),
    cancelNotification: jest.fn(),
    createChannel: jest.fn(),
    onBackgroundEvent: jest.fn(),
    createTriggerNotification: jest.fn(),
    cancelTriggerNotification: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  EventType: { ACTION_PRESS: 2 },
}), { virtual: true });
jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));
jest.mock('../src/sheets', () => ({ openTransaction: jest.fn() }));

import SmsBackgroundTask from '../src/native/SmsBackgroundTask';
import { handleNotificationAction } from '../src/notifications/notifeeIntegration';
import { getDb } from '../src/db';
import { openDatabase } from '../src/db/driver';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import { createCategory, topUpCategoryId } from '../src/db/categories';
import { getTransferTypeId } from '../src/db/categoryTypes';
import { monthIncome, monthStats, periodStats, setPlanAmount, ymOf } from '../src/db/plans';
import { addManualTransaction } from '../src/db/transactions';
import { freshDb } from './helpers';

const Y = 2099, M = 2; // March (months from 0, as ymOf / monthStats take them); GEL only: no rates needed
const at = (day: number) => Math.floor(new Date(Y, M, day, 12).getTime() / 1000);
const op = (kind: 'transfer' | 'deposit' | 'purchase', lari: number, categoryId: number | null, day = 5) =>
  addManualTransaction({ amount_minor: lari * 100, currency: 'GEL', category_id: categoryId, occurred_at: at(day), kind });
const statOf = async (id: number) => (await monthStats(Y, M)).categories.find((c) => c.category_id === id);

let mom: number;
let topUp: number;
beforeEach(async () => {
  await freshDb();
  displayNotification.mockReset();
  mom = await createCategory('Маме', '👩', await getTransferTypeId());
  topUp = (await topUpCategoryId())!;
});

describe('a transfer category within a month', () => {
  it('sent 300, 200 came back: −100, spent 100', async () => {
    await op('transfer', 300, mom); await op('deposit', 200, mom);
    expect(await statOf(mom)).toMatchObject({ spent_minor: 10000, transfer: true });
    expect((await monthStats(Y, M)).spent_minor).toBe(10000);
    expect(await monthIncome(ymOf(Y, M))).toBe(0);
  });

  it('sent 300, 400 came back: +100, nothing spent, +100 in the month\'s income', async () => {
    await op('transfer', 300, mom); await op('deposit', 400, mom); await op('purchase', 50, null);
    const s = await monthStats(Y, M);
    expect(s.categories.find((c) => c.category_id === mom)).toMatchObject({ spent_minor: -10000, transfer: true });
    // only the purchase is spending; the transfer section adds nothing
    expect(s.spent_minor).toBe(5000);
    expect(s.groups.find((g) => g.title === 'Переводы')?.spent_minor).toBe(0);
    expect(await monthIncome(ymOf(Y, M))).toBe(10000);
  });

  it('each month on its own: lent in one, paid back in the next', async () => {
    await op('transfer', 300, mom, 5);
    await addManualTransaction({ amount_minor: 30000, currency: 'GEL', category_id: mom, occurred_at: Math.floor(new Date(Y, M + 1, 5, 12).getTime() / 1000), kind: 'deposit' });
    expect((await statOf(mom))?.spent_minor).toBe(30000);
    expect((await monthStats(Y, M + 1)).categories.find((c) => c.category_id === mom)?.spent_minor).toBe(-30000);
    expect(await monthIncome(ymOf(Y, M + 1))).toBe(30000);
  });

  it('with a plan: more back than sent counts as nothing spent of it', async () => {
    await setPlanAmount(ymOf(Y, M), mom, 20000);
    await op('transfer', 100, mom); await op('deposit', 300, mom);
    const s = await monthStats(Y, M);
    expect(s.spent_minor).toBe(0);
    expect(s.categories.find((c) => c.category_id === mom)?.limit_minor).toBe(20000);
  });

  it('a period: listed with its "+", not in the total', async () => {
    await op('transfer', 100, mom); await op('deposit', 300, mom); await op('purchase', 40, null);
    const p = await periodStats(at(1), at(28));
    expect(p.categories.map((c) => [c.category_id, c.spent_minor])).toEqual([[null, 4000], [mom, -20000]]);
    expect(p.spent_minor).toBe(4000);
  });
});

describe('"Пополнение счёта"', () => {
  it('is no spending; its deposits are the month\'s income', async () => {
    await op('deposit', 2752, topUp); await op('deposit', 82, topUp); await op('purchase', 10, null);
    const s = await monthStats(Y, M);
    expect(s.categories.find((c) => c.category_id === topUp)).toBeUndefined();
    expect(s.spent_minor).toBe(1000);
    expect(await monthIncome(ymOf(Y, M))).toBe(283400);
  });

  it('a deposit from the bank goes there, without a merchant rule; the push offers the transfer categories', async () => {
    await createCategory('Долги', '🤝', await getTransferTypeId());
    await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Deposit Money: 200.00 GEL\nMC GOLD\n03/10/2026\nNAIRA ZHORDANIA', timestamp: 1 });
    const db = await getDb();
    expect(await db.get("SELECT category_id, category_source FROM transactions WHERE kind = 'deposit'")).toEqual({ category_id: topUp, category_source: null });
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
    const n = displayNotification.mock.calls[0][0];
    expect(n.title).toMatch(/^Пополнение — 200\.00.₾ → 💳 Пополнение счёта$/);
    expect(n.body).toBe('NAIRA ZHORDANIA');
    const titles = n.android.actions.map((a: any) => a.title);
    expect(titles).toHaveLength(3);
    expect(titles.slice(0, 2).sort()).toEqual(['👩 Переводы: Маме', '🤝 Переводы: Долги']);
    expect(titles[2]).toBe('➡️ К категориям');

    // a button moves it there: a person paying back
    await handleNotificationAction({ id: `suggest_${mom}`, notification: { id: n.id, data: n.data } });
    expect(await db.get("SELECT category_id FROM transactions WHERE kind = 'deposit'")).toEqual({ category_id: mom });
  });

  it('a deposit without a sender too; with no transfer categories the push just opens it', async () => {
    await (await getDb()).run('DELETE FROM categories WHERE id = ?', [mom]);
    await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Deposit Money: 50.00 GEL\nMC GOLD\n03/10/2026', timestamp: 2 });
    expect(await (await getDb()).get("SELECT category_id FROM transactions WHERE kind = 'deposit'")).toEqual({ category_id: topUp });
    expect(displayNotification.mock.calls[0][0].android.actions.map((a: any) => a.title)).toEqual(['➡️ К категориям']);
  });
});

test('migration 27: "Пополнение счёта"; deposits without a category go there; "Прочие" goes — its deposits there, the rest without a category', async () => {
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 26));
  const other = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Прочие'"))!.id;
  const ins = (kind: string, cat: number | null, n: number) => db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, 100, 'GEL', ?, 'user', 1, '', ?)`, [kind, cat, `h${n}`]);
  await ins('deposit', other, 1); await ins('transfer', other, 2); await ins('deposit', null, 3); await ins('deposit', 1, 4);
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, currency, kind, norm_period, pinned) VALUES ('2099-01', ?, 100, 'GEL', 'limit', 'day', 0)", [other]);
  await migrate(db);
  const topUpId = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'topup'"))!.id;
  expect(await db.get("SELECT name, emoji FROM categories WHERE system = 'topup'")).toEqual({ name: 'Пополнение счёта', emoji: '💳' });
  expect(await db.all('SELECT kind, category_id FROM transactions ORDER BY sms_hash')).toEqual([
    { kind: 'deposit', category_id: topUpId },
    { kind: 'transfer', category_id: null },
    { kind: 'deposit', category_id: topUpId },
    // a deposit someone put in another category stays there
    { kind: 'deposit', category_id: 1 },
  ]);
  expect(await db.get('SELECT * FROM categories WHERE id = ?', [other])).toBeUndefined();
  expect(await db.get('SELECT * FROM plan_items WHERE category_id = ?', [other])).toBeUndefined();
});
