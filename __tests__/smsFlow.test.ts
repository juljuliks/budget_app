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
import { createRule } from '../src/categorize';
import { createCategory } from '../src/db/categories';
import { getTransferTypeId } from '../src/db/categoryTypes';
import { getDb } from '../src/db';
import { freshDb } from './helpers';

const MC_GOLD_1 = { sender: 'TBC SMS', body: '12.50GEL\n(*XXXX)\nMC GOLD\nBalance: 100.00GEL\n28/09/26 14:00', timestamp: 1759060800000 };
const MC_GOLD_2 = { ...MC_GOLD_1, body: MC_GOLD_1.body.replace('12.50', '7.00'), timestamp: 1759064400000 };

const tx = async (sql: string, params: any[] = []) => (await getDb()).get(sql, params);

beforeEach(async () => {
  await freshDb();
  displayNotification.mockReset();
  cancelNotification.mockReset();
  navigateWhenReady.mockReset();
});

test('new uncategorized transaction is stored and a notification with suggestions is shown', async () => {
  await SmsBackgroundTask(MC_GOLD_1);

  const row = await tx('SELECT * FROM transactions');
  expect(row).toMatchObject({ amount_minor: 1250, currency: 'GEL', merchant_key: 'MC GOLD', category_id: null });

  expect(displayNotification).toHaveBeenCalledTimes(1);
  const n = displayNotification.mock.calls[0][0];
  expect(n.data).toEqual({ txId: String(row.id), merchant_key: 'MC GOLD' });
  // Android shows at most 3 buttons: 2 suggestions + "new category" (always last)
  expect(n.android.actions).toHaveLength(3);
  expect(n.android.actions[2].pressAction.id).toBe('create_new');
  expect(n.android.actions.map((a: any) => a.title)).not.toContainEqual(expect.stringContaining('Переводы'));
});

test('same SMS delivered twice is stored once and notified once', async () => {
  await SmsBackgroundTask(MC_GOLD_1);
  await SmsBackgroundTask(MC_GOLD_1);
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(1);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});

test('non-transaction SMS is ignored', async () => {
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Balance: 281.00GEL\n28/09/26 13:47', timestamp: 1 });
  expect((await tx('SELECT count(*) AS n FROM transactions')).n).toBe(0);
  expect(displayNotification).not.toHaveBeenCalled();
});

test('merchant rule categorizes on arrival, no notification', async () => {
  await createRule('prefix', 'MC', 3);
  await SmsBackgroundTask(MC_GOLD_1);
  expect(await tx('SELECT category_id, category_source FROM transactions')).toEqual({ category_id: 3, category_source: 'rule' });
  expect((await tx('SELECT usage_count FROM category_usage WHERE category_id = 3')).usage_count).toBe(1);
  expect(displayNotification).not.toHaveBeenCalled();
});

test('picking a suggestion assigns the category, creates a rule and backfills same merchant', async () => {
  await SmsBackgroundTask(MC_GOLD_1);
  await SmsBackgroundTask(MC_GOLD_2);
  const first = displayNotification.mock.calls[0][0];

  await handleNotificationAction({ id: 'suggest_2', notification: { id: first.id, data: first.data } });

  const rows = await (await getDb()).all('SELECT category_id, category_source FROM transactions ORDER BY id');
  expect(rows).toEqual([
    { category_id: 2, category_source: 'user' },
    { category_id: 2, category_source: 'rule' },
  ]);
  expect(await tx("SELECT category_id FROM merchant_rules WHERE match_type = 'exact' AND pattern = 'MC GOLD'")).toEqual({ category_id: 2 });
  expect((await tx('SELECT usage_count FROM category_usage WHERE category_id = 2')).usage_count).toBe(1);
  expect(cancelNotification).toHaveBeenCalledWith(first.id);

  // the next SMS from this merchant is categorized automatically
  await SmsBackgroundTask({ ...MC_GOLD_1, timestamp: MC_GOLD_1.timestamp + 1 });
  expect(displayNotification).toHaveBeenCalledTimes(2);
});

test('backfill does not overwrite a category the user set manually', async () => {
  await SmsBackgroundTask(MC_GOLD_1);
  await SmsBackgroundTask(MC_GOLD_2);
  const [a, b] = displayNotification.mock.calls.map((c) => c[0]);

  await handleNotificationAction({ id: 'suggest_5', notification: { id: b.id, data: b.data } });
  await handleNotificationAction({ id: 'suggest_2', notification: { id: a.id, data: a.data } });

  const rows = await (await getDb()).all('SELECT category_id FROM transactions ORDER BY id');
  expect(rows.map((r) => r.category_id)).toEqual([2, 5]);
});

test('"create new" action opens the category editor for this transaction', async () => {
  await SmsBackgroundTask(MC_GOLD_1);
  const n = displayNotification.mock.calls[0][0];
  const action = n.android.actions.find((a: any) => a.pressAction.id === 'create_new');
  expect(action.pressAction.launchActivity).toBe('default');

  await handleNotificationAction({ id: 'create_new', notification: { id: n.id, data: n.data } });
  expect(navigateWhenReady).toHaveBeenCalledWith({ name: 'CategoryEdit', params: { txId: Number(n.data.txId) } });
  expect(cancelNotification).toHaveBeenCalledWith(n.id);
});

test('tapping the notification body opens the transaction and keeps the notification', async () => {
  await SmsBackgroundTask(MC_GOLD_1);
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
  expect(n.android.actions[2].pressAction.id).toBe('create_new');
});

test('money transfer with no transfer categories still offers "new category"', async () => {
  const db = await getDb();
  await db.run('UPDATE categories SET type_id = NULL');
  await SmsBackgroundTask({ sender: 'TBC SMS', body: 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', timestamp: 1 });
  const ids = displayNotification.mock.calls[0][0].android.actions.map((a: any) => a.pressAction.id);
  expect(ids).toEqual(['create_new']);
});

test('task logs and swallows DB errors instead of throwing', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  (await getDb()).close();
  await expect(SmsBackgroundTask(MC_GOLD_1)).resolves.toBeUndefined();
  expect(err).toHaveBeenCalledWith('SmsBackgroundTask failed', expect.anything());
  err.mockRestore();
});
