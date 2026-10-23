// 8: the notifications — what a new operation without a category shows and what its buttons do, the limits, the
// month's report on the 1st. notifee is a mock: what the app gives it is checked. Today: 15 October 2026.
import { act, waitFor } from '@testing-library/react-native';
import notifee from '@notifee/react-native';
import { openApp, screen } from './app';
import { ops, planned } from '../e2e/seeds';
import SmsBackgroundTask from '../../src/native/SmsBackgroundTask';
import { handleNotificationAction } from '../../src/notifications/notifeeIntegration';
import { scheduleMonthReports } from '../../src/notifications/monthReportNotice';
import { setPlanBudget } from '../../src/db/plans';
import { getDb } from '../../src/db';
import { freshDb } from '../helpers';
import { done } from '../e2e/seeds';

const display = notifee.displayNotification as jest.Mock;
const nb = (s: string) => s.replace(/ /g, ' ');
/** the notifications shown: [title, body, the buttons' titles] */
const shown = () => display.mock.calls.map(([n]) => [nb(n.title), nb(n.body), (n.android?.actions ?? []).map((a: { title: string }) => a.title)]);
const sms = (body: string) => act(() => SmsBackgroundTask({ sender: 'TBC', body, timestamp: Date.now() }));
const today = '15/10/2026 11:30';

beforeEach(() => jest.clearAllMocks());

describe('8.1 a new operation', () => {
  beforeEach(async () => { await freshDb(); await ops(); await done(); });

  test('without a category: the amount, the merchant, the two most used categories and "К категориям"', async () => {
    await sms(`12.00GEL\n(*1234)\nNEWSHOP\n${today}`);
    expect(shown()).toEqual([['Покупка — 12.00 ₾', 'NEWSHOP', ['🛒 Продукты', '☕️ Кафе и рестораны', '➡️ К категориям']]]);
  });
  test('a transfer: the transfer categories, without their section', async () => {
    await sms('Money Transfer:\n15.00 GEL\nMC GOLD\n15/10/2026\nANA K');
    // no transfer categories of one's own yet (the seeded "Прочие" went): the system "Между своими картами" and the list
    expect(shown()).toEqual([['Перевод — 15.00 ₾', 'ANA K', ['🔁 Между своими картами', '➡️ К категориям']]]);
  });
  test('a merchant of different categories: its own first', async () => {
    const db = await getDb();
    await db.run("INSERT INTO mixed_merchants (merchant_key, created_at) VALUES ('GLOVO', 0)");
    await db.run("INSERT INTO merchant_categories (merchant_key, category_id) SELECT 'GLOVO', id FROM categories WHERE name = 'Кафе и рестораны'");
    await sms(`20.00GEL\n(*1234)\nGLOVO\n${today}`);
    expect(shown()).toEqual([['Покупка — 20.00 ₾', 'GLOVO · выберите категорию', ['☕️ Кафе и рестораны', '🛒 Продукты', '➡️ К категориям']]]);
    // the primary category is already on the operation; leaving the notification keeps it
    expect(await db.get("SELECT c.name AS n, t.category_source AS s FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = 'GLOVO' AND t.amount_minor = 2000"))
      .toEqual({ n: 'Кафе и рестораны', s: 'rule' });
  });
  test('a refund without a category: just news', async () => {
    await sms('A refund of 7.00 GEL has been initiated by NOBODY to your MC GOLD (*1834).');
    expect(shown()).toEqual([['Возврат — 7.00 ₾', 'NOBODY · без категории', []]]);
  });
  test('with its merchant\'s category: none (no limit reached)', async () => {
    await sms(`5.00GEL\n(*1234)\nSPAR\n${today}`);
    expect(display).not.toHaveBeenCalled();
  });
});

describe('8.1 the buttons', () => {
  test('a category button: it is the operation\'s and the merchant\'s; the notification goes', async () => {
    await freshDb(); await ops(); await done();
    await sms(`12.00GEL\n(*1234)\nNEWSHOP\n${today}`);
    const [n] = display.mock.calls[0];
    const food = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Продукты'"))!.id;
    await handleNotificationAction({ id: `suggest_${food}`, notification: { id: n.id, data: n.data } });
    expect(await (await getDb()).get("SELECT category_id AS c, category_source AS s FROM transactions WHERE raw_merchant = 'NEWSHOP'")).toEqual({ c: food, s: 'rule' });
    expect(await (await getDb()).get("SELECT category_id AS c FROM merchant_rules WHERE pattern = 'NEWSHOP'")).toEqual({ c: food });
    expect(notifee.cancelNotification).toHaveBeenCalledWith(n.id);
  });

  test('a tap or "К категориям": the operation opens; the notification stays', async () => {
    await openApp(ops);
    await sms(`12.00GEL\n(*1234)\nNEWSHOP\n${today}`);
    const [n] = display.mock.calls[0];
    await act(() => handleNotificationAction({ id: 'all_categories', notification: { id: n.id, data: n.data } }));
    expect(await screen.findByText('Сменить')).toBeTruthy();
    expect(screen.getByText('⚪️ Без категории')).toBeTruthy();
    expect(screen.getByText('NEWSHOP ›')).toBeTruthy();
    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });
});

describe('8.3 the limits', () => {
  test('a week\'s limit at 80%; a month\'s plan over; each once', async () => {
    await freshDb(); await planned(); await done();
    // Кафе this week: 50 of 94.50 → +30 = 80 (85%); the month 120 of 310 (WOLT's operations get Кафе)
    await (await getDb()).run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) SELECT 'exact', 'WOLT', id, 0 FROM categories WHERE name = 'Кафе и рестораны'");
    await sms(`30.00GEL\n(*1234)\nWOLT\n${today}`);
    expect(shown()).toEqual([['☕️ Кафе и рестораны — 80% лимита на неделю', '12 – 18 окт: потрачено 80 ₾ из 94.50 ₾, осталось 14.50 ₾', []]]);
    display.mockClear();
    // Одежда (a month's limit): 450 of 400 → the plan over
    await sms(`10.00GEL\n(*1234)\nZARA\n${today}`);
    expect(shown()).toEqual([['👕 Одежда — план на октябрь превышен', 'Потрачено 460 ₾ из 400 ₾, перерасход 60 ₾', []]]);
    display.mockClear();
    await sms(`5.00GEL\n(*1234)\nZARA\n15/10/2026 11:45`);
    expect(display).not.toHaveBeenCalled();
  });
  test('turned off: none', async () => {
    await freshDb(); await planned(); await done();
    const { setLimitAlertsEnabled } = require('../../src/notifications/limitAlerts');
    await setLimitAlertsEnabled(false);
    await sms(`200.00GEL\n(*1234)\nSPAR\n${today}`);
    expect(display).not.toHaveBeenCalled();
  });
});

describe('8.2 the month\'s report on the 1st', () => {
  test('a month with a budget: its "Итоги" instead, at 10:00 on the 1st — what goes to savings as planned', async () => {
    await freshDb(); await planned(); await done();
    await scheduleMonthReports();
    const calls = (notifee.createTriggerNotification as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    const [n, trigger] = calls[0];
    expect(n).toMatchObject({ id: 'report_2026-10', title: 'Итоги октября — удалось отложить?', data: { kind: 'close', ym: '2026-10' } });
    expect(nb(n.body)).toMatch(/^В сбережения по плану [\d ]+ ₾$/);
    expect(new Date(trigger.timestamp)).toEqual(new Date(2026, 10, 1, 10));
  });

  test('nothing to ask (a plan without a budget or funds): the report, with what is spent', async () => {
    await freshDb(); await planned(); await setPlanBudget('2026-10', null); await done();
    await scheduleMonthReports();
    const [n] = (notifee.createTriggerNotification as jest.Mock).mock.calls[0];
    expect(n.title).toBe('Отчёт за октябрь');
    expect(nb(n.body)).toMatch(/^Потрачено [\d ]+ ₾$/);
  });

  test('the "Итоги" one\'s tap: the month\'s "Итоги"; closed by then — its report', async () => {
    await openApp(planned);
    await act(() => handleNotificationAction({ id: 'month_report', notification: { data: { kind: 'close', ym: '2026-09' } } }));
    expect(await screen.findByText('Итоги · Сентябрь 2026')).toBeTruthy();
  });
  test('a month without a plan: none, a scheduled one cancelled', async () => {
    await freshDb(); await ops(); await done();
    await scheduleMonthReports();
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith('report_2026-10');
  });
  test('its tap: the stats with the report', async () => {
    await openApp(planned);
    await act(() => handleNotificationAction({ id: 'month_report', notification: { data: { ym: '2026-09' } } }));
    expect(await screen.findByText('Отчёт · Сентябрь 2026')).toBeTruthy();
  });
  test('a limit\'s tap: the stats', async () => {
    await openApp(planned);
    await act(() => handleNotificationAction({ id: 'limits' }));
    await waitFor(() => expect(screen.getByText('за месяц')).toBeTruthy());
  });
});

describe('8.4 "Скрывать суммы в уведомлениях" (Блокировка)', () => {
  const { memoryLock } = require('../../src/native/appLock') as typeof import('../../src/native/appLock');
  beforeEach(() => Object.assign(memoryLock, { pin: '1234', hideNotifications: true }));
  afterEach(() => memoryLock.reset());

  test('an operation: its type and merchant, no amount; a limit: "Суммы — в приложении"; the report too', async () => {
    await freshDb(); await planned(); await done();
    await sms(`12.00GEL\n(*1234)\nNEWSHOP\n${today}`);
    expect(shown()[0].slice(0, 2)).toEqual(['Покупка', 'NEWSHOP']);
    display.mockClear();
    await sms(`10.00GEL\n(*1234)\nZARA\n${today}`);
    expect(shown()).toEqual([['👕 Одежда — план на октябрь превышен', 'Суммы — в приложении', []]]);
    await scheduleMonthReports(new Date(2026, 9, 15));
    expect((notifee.createTriggerNotification as jest.Mock).mock.calls[0][0].body).toBe('Суммы — в приложении');
  });
  test('the lock off: the amounts as before', async () => {
    memoryLock.reset();
    await freshDb(); await ops(); await done();
    await sms(`12.00GEL\n(*1234)\nNEWSHOP\n${today}`);
    expect(shown()[0][0]).toBe('Покупка — 12.00 ₾');
  });
});
