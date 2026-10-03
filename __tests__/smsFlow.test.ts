// Integration: headless SMS task -> DB insert -> notification -> action press -> category + rule.
const displayNotification = jest.fn();
const cancelNotification = jest.fn();
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: (...a: any[]) => displayNotification(...a),
    cancelNotification: (...a: any[]) => cancelNotification(...a),
    createChannel: jest.fn(),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { HIGH: 4 },
  EventType: { ACTION_PRESS: 2 },
}), { virtual: true });
const navigateWhenReady = jest.fn();
jest.mock('../src/navigation', () => ({ navigateWhenReady: (...a: any[]) => navigateWhenReady(...a) }));

import SmsBackgroundTask from '../src/native/SmsBackgroundTask';
import { handleNotificationAction } from '../src/notifications/notifeeIntegration';
import { backfillRule, createRule } from '../src/categorize';
import { assignCategory, reattachMerchant } from '../src/assign';
import { setMerchantDetached } from '../src/db/transactions';
import { createCategory } from '../src/db/categories';
import { getTransferTypeId } from '../src/db/categoryTypes';
import { getDb } from '../src/db';
import { freshDb } from './helpers';

const SPAR_1 = { sender: 'TBC SMS', body: '12.50GEL\n(*XXXX)\nSPAR\nBalance: 100.00GEL\n28/09/26 14:00', timestamp: 1759060800000 };
const SPAR_2 = { ...SPAR_1, body: SPAR_1.body.replace('12.50', '7.00'), timestamp: 1759064400000 };

const tx = async (sql: string, params: any[] = []) => (await getDb()).get(sql, params);

beforeEach(async () => {
  await freshDb();
  displayNotification.mockReset();
  cancelNotification.mockReset();
  navigateWhenReady.mockReset();
});

test('new uncategorized transaction is stored and a notification with suggestions is shown', async () => {
  await SmsBackgroundTask(SPAR_1);

  const row = await tx('SELECT * FROM transactions');
  expect(row).toMatchObject({ amount_minor: 1250, currency: 'GEL', merchant_key: 'SPAR', category_id: null });

  expect(displayNotification).toHaveBeenCalledTimes(1);
  const n = displayNotification.mock.calls[0][0];
  expect(n.data).toEqual({ txId: String(row.id), merchant_key: 'SPAR' });
  // Android shows at most 3 buttons: 2 suggestions + "all categories" (always last)
  expect(n.android.actions).toHaveLength(3);
  expect(n.android.actions[2].pressAction.id).toBe('all_categories');
  expect(n.android.actions.map((a: any) => a.title)).not.toContainEqual(expect.stringContaining('Переводы'));
});

test('same SMS delivered twice is stored once and notified once', async () => {
  await SmsBackgroundTask(SPAR_1);
  await SmsBackgroundTask(SPAR_1);
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(1);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});

test('non-transaction SMS is ignored', async () => {
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Balance: 281.00GEL\n28/09/26 13:47', timestamp: 1 });
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(0);
  expect(displayNotification).not.toHaveBeenCalled();
});

test('merchant rule categorizes on arrival, no notification', async () => {
  await createRule('prefix', 'SP', 3);
  await SmsBackgroundTask(SPAR_1);
  expect(await tx('SELECT category_id, category_source FROM transactions')).toEqual({ category_id: 3, category_source: 'rule' });
  expect((await tx('SELECT usage_count FROM category_usage WHERE category_id = 3')).usage_count).toBe(1);
  expect(displayNotification).not.toHaveBeenCalled();
});

test('picking a suggestion assigns the category, creates a rule and backfills same merchant', async () => {
  await SmsBackgroundTask(SPAR_1);
  await SmsBackgroundTask(SPAR_2);
  const first = displayNotification.mock.calls[0][0];

  await handleNotificationAction({ id: 'suggest_2', notification: { id: first.id, data: first.data } });

  const rows = await (await getDb()).all('SELECT category_id, category_source FROM transactions ORDER BY id');
  expect(rows).toEqual([
    { category_id: 2, category_source: 'user' },
    { category_id: 2, category_source: 'rule' },
  ]);
  expect(await tx("SELECT category_id FROM merchant_rules WHERE match_type = 'exact' AND pattern = 'SPAR'")).toEqual({ category_id: 2 });
  expect((await tx('SELECT usage_count FROM category_usage WHERE category_id = 2')).usage_count).toBe(1);
  expect(cancelNotification).toHaveBeenCalledWith(first.id);

  // the next SMS from this merchant is categorized automatically
  await SmsBackgroundTask({ ...SPAR_1, timestamp: SPAR_1.timestamp + 1 });
  expect(displayNotification).toHaveBeenCalledTimes(2);
});

test('backfill does not overwrite a category the user set manually', async () => {
  await SmsBackgroundTask(SPAR_1);
  await SmsBackgroundTask(SPAR_2);
  const [a, b] = displayNotification.mock.calls.map((c) => c[0]);

  await handleNotificationAction({ id: 'suggest_5', notification: { id: b.id, data: b.data } });
  await handleNotificationAction({ id: 'suggest_2', notification: { id: a.id, data: a.data } });

  const rows = await (await getDb()).all('SELECT category_id FROM transactions ORDER BY id');
  expect(rows.map((r) => r.category_id)).toEqual([2, 5]);
});

test('"К категориям" opens the transaction with the category list and keeps the notification', async () => {
  await SmsBackgroundTask(SPAR_1);
  const n = displayNotification.mock.calls[0][0];
  const action = n.android.actions.find((a: any) => a.pressAction.id === 'all_categories');
  expect(action.title).toBe('➡️ К категориям');
  expect(action.pressAction.launchActivity).toBe('default');

  // also the "new category" button of notifications posted by older versions
  for (const id of ['all_categories', 'create_new']) {
    await handleNotificationAction({ id, notification: { id: n.id, data: n.data } });
    expect(navigateWhenReady).toHaveBeenLastCalledWith({ name: 'TransactionDetail', params: { txId: Number(n.data.txId) } });
  }
  expect(cancelNotification).not.toHaveBeenCalled();
});

test('tapping the notification body opens the transaction and keeps the notification', async () => {
  await SmsBackgroundTask(SPAR_1);
  const n = displayNotification.mock.calls[0][0];
  await handleNotificationAction({ id: 'default', notification: { id: n.id, data: n.data } });
  expect(navigateWhenReady).toHaveBeenCalledWith({ name: 'TransactionDetail', params: { txId: Number(n.data.txId) } });
  expect(cancelNotification).not.toHaveBeenCalled();
});

test('money transfer offers only categories of the transfer type, plus "new category"', async () => {
  await createCategory('Маме', '👩', await getTransferTypeId());
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', timestamp: 1 });
  const n = displayNotification.mock.calls[0][0];
  expect(n.title).toMatch(/^Перевод/);
  const titles = n.android.actions.map((a: any) => a.title);
  expect(titles).toHaveLength(3);
  expect(titles.slice(0, 2).sort()).toEqual(['👩 Переводы: Маме', '🔁 Переводы: Прочие']);
  expect(n.android.actions[2].pressAction.id).toBe('all_categories');
});

test('the same operation by SMS and by bank push is stored once; two real purchases stay two', async () => {
  const body = '12.50GEL\n(*XXXX)\nSPAR\nBalance: 100.00GEL\n28/09/26 14:00';
  await SmsBackgroundTask({ sender: 'TBC SMS', body, timestamp: 1759060800000 });
  await SmsBackgroundTask({ sender: 'push:ge.tbcbank', body, timestamp: 1759060860000, source: 'push' });
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(1);
  // a second identical purchase by SMS (another SMS) is a real second purchase
  await SmsBackgroundTask({ sender: 'TBC SMS', body, timestamp: 1759060900000 });
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(2);
});

test('a refund asks to find its purchase instead of a category', async () => {
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'A refund of 94.78 GEL has been initiated by TEMU.COM to your MC GOLD (*1834). The amount will be credited to your account within 2–5 days.', timestamp: 1 });
  const n = displayNotification.mock.calls[0][0];
  expect(n.title).toBe('Возврат — 94.78 GEL');
  expect(n.android.actions.map((a: any) => a.pressAction.id)).toEqual(['refund_resolve']);
  await handleNotificationAction({ id: 'refund_resolve', notification: { id: n.id, data: n.data } });
  expect(navigateWhenReady).toHaveBeenLastCalledWith({ name: 'RefundResolve', params: { refundId: Number(n.data.txId) } });
  expect(cancelNotification).not.toHaveBeenCalled();
});

test('"Запомнить" off: the category is for this transaction only, the merchant rule stays', async () => {
  await createRule('exact', 'SPAR', 3);
  await SmsBackgroundTask(SPAR_1);
  const id = (await tx('SELECT id FROM transactions')).id;
  await assignCategory(id, 2, { applyToMerchant: false });
  expect(await tx('SELECT pattern, category_id FROM merchant_rules')).toEqual({ pattern: 'SPAR', category_id: 3 });
  expect(await tx('SELECT category_id, category_source FROM transactions')).toEqual({ category_id: 2, category_source: 'user' });
});

test('a detached transaction: rules skip it and its category teaches nothing', async () => {
  await SmsBackgroundTask(SPAR_1);
  const id = (await tx('SELECT id FROM transactions')).id;
  await setMerchantDetached(id, true);
  await backfillRule('exact', 'SPAR', 3);
  expect(await tx('SELECT category_id FROM transactions')).toEqual({ category_id: null });
  await assignCategory(id, 2);
  expect(await tx('SELECT * FROM merchant_rules')).toBeUndefined();
});

test('reattaching a detached transaction gives it the merchant rule category', async () => {
  await createRule('exact', 'SPAR', 3);
  await SmsBackgroundTask(SPAR_1);
  const id = (await tx('SELECT id FROM transactions')).id;
  await setMerchantDetached(id, true);
  await assignCategory(id, 2);
  expect(await tx('SELECT category_id, category_source FROM transactions')).toEqual({ category_id: 2, category_source: 'user' });
  await reattachMerchant(id);
  expect(await tx('SELECT category_id, category_source, merchant_detached FROM transactions'))
    .toEqual({ category_id: 3, category_source: 'rule', merchant_detached: 0 });
});

test('reattaching without a merchant rule keeps the category', async () => {
  await SmsBackgroundTask(SPAR_1);
  const id = (await tx('SELECT id FROM transactions')).id;
  await setMerchantDetached(id, true);
  await assignCategory(id, 2);
  await reattachMerchant(id);
  expect(await tx('SELECT category_id, merchant_detached FROM transactions')).toEqual({ category_id: 2, merchant_detached: 0 });
});

test('a merchant rule never categorizes a money transfer: every transfer asks for a category', async () => {
  // a purchase rule for the same line ("MC GOLD" is the card type on transfers)
  await createRule('exact', 'MC GOLD', 3);
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', timestamp: 1 });
  expect(await tx("SELECT category_id FROM transactions WHERE kind = 'transfer'")).toEqual({ category_id: null });
  expect(displayNotification).toHaveBeenCalledTimes(1);
  // remembering a purchase for that merchant doesn't touch the transfer either
  await backfillRule('exact', 'MC GOLD', 3);
  expect(await tx("SELECT category_id FROM transactions WHERE kind = 'transfer'")).toEqual({ category_id: null });
});

test('picking a category for a money transfer creates no merchant rule', async () => {
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', timestamp: 1 });
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n2.00 GEL\nMC GOLD\n02/10/2026', timestamp: 2 });
  const [first] = displayNotification.mock.calls.map((c) => c[0]);
  const transferCat = first.android.actions[0].pressAction.id;
  await handleNotificationAction({ id: transferCat, notification: { id: first.id, data: first.data } });
  const db = await getDb();
  expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
  // the other transfer to the same person stays uncategorized
  expect((await db.all('SELECT category_id FROM transactions ORDER BY id')).map((r) => r.category_id === null)).toEqual([false, true]);
});

test('money transfer with no transfer categories still offers "new category"', async () => {
  const db = await getDb();
  await db.run('UPDATE categories SET type_id = NULL');
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', timestamp: 1 });
  const ids = displayNotification.mock.calls[0][0].android.actions.map((a: any) => a.pressAction.id);
  expect(ids).toEqual(['all_categories']);
});

test('task logs and swallows DB errors instead of throwing', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  (await getDb()).close();
  await expect(SmsBackgroundTask(SPAR_1)).resolves.toBeUndefined();
  expect(err).toHaveBeenCalledWith('SmsBackgroundTask failed', expect.anything());
  err.mockRestore();
});
