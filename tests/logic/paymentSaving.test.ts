// Saving up for a subscription (db/recurring/saving*.ts): the month the saving is for, its months, the plan's
// "Подписки" with the contributions instead of the charges paid from what was saved, the month's spending, turning it off.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { listPlan, monthStats, setPlanBudget } from '../../src/db/plans';
import {
  deletePayment, restorePayment, savePayment, savedNow, savingFor, savingMonths, savingOfTransaction, startSaving, stopSaving, undoSaving,
} from '../../src/db/recurring';

let n = 0;
const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
async function charge(merchant: string, amount: number, when: string) {
  n++;
  await (await getDb()).run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', ?, 'GEL', ?, ?, ?, 'user', ?, ?, ?)`,
    [amount, merchant, merchant, await subscriptionsCategoryId(), at(when), `sms ${n}`, `h${n}`]);
}
const YANDEX = { merchant_key: 'YANDEX', name: 'Яндекс Плюс', amount_minor: 4500, currency: 'GEL' as const, period: 3 };
const subsItem = async (ym: string) => (await listPlan(ym)).find((i) => i.recurring)?.limit_minor;
const subsSpent = async (year: number, month: number) => (await monthStats(year, month, 'GEL')).categories.find((c) => c.name === 'Подписки')?.spent_minor ?? 0;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-18T12:00:00'), advanceTimers: true });
  await freshDb();
  await setPlanBudget('2026-10', 500000, 'GEL');
});
afterEach(() => jest.useRealTimers());

describe('the month a saving is for', () => {
  test('the first charge from the month on; one paid a few days early belongs to the month it was paid in', () => {
    expect(savingFor('2027-01-29', 3, '2026-10', [])).toBe('2027-01-29');
    expect(savingFor('2026-11-01', 3, '2026-10', [])).toBe('2026-11-01');
    // November's charge paid on 29 October: November saves for February's
    expect(savingFor('2026-11-01', 3, '2026-11', ['2026-10-29'])).toBe('2027-02-01');
  });

  test('its months: the amount over the months left, a charge takes what was saved, past it — the month\'s', () => {
    const r = savingMonths({
      since: '2026-10', last: '2027-02', nowYm: '2026-10', start: 0, amount: 4500, planned: () => true, stored: new Map(),
      dueOf: (ym) => (ym <= '2027-01' ? '2027-01-29' : '2027-04-29'),
      spends: [{ id: 1, at: at('2027-01-29T10:00:00'), value: 5000 }],
    });
    expect(r.months.map((m) => [m.ym, m.contribution, m.shortage, m.end])).toEqual([
      ['2026-10', 1200, 0, 1200], ['2026-11', 1100, 0, 2300], ['2026-12', 1100, 0, 3400], ['2027-01', 1100, 500, 0], ['2027-02', 1500, 0, 1500],
    ]);
  });
});

describe('saving up for a subscription', () => {
  test('the plan has the contribution, not the charge; "Подписки" spent it', async () => {
    const id = await savePayment({ ...YANDEX, due: '2027-01-29' });
    expect(await subsItem('2026-10')).toBe(0);
    await startSaving(id, 0);
    expect(await subsItem('2026-10')).toBe(1200);
    expect(await subsSpent(2026, 9)).toBe(1200);
    // the next month: from what October put in
    await setPlanBudget('2026-11', 500000, 'GEL');
    expect(await subsItem('2026-11')).toBe(1100);
  });

  test('a charge paid from what was saved isn\'t the month\'s spending', async () => {
    const id = await savePayment({ ...YANDEX, due: '2026-10-29' });
    await startSaving(id, 4500);
    await charge('YANDEX', 4500, '2026-10-29T10:00:00');
    expect(await subsItem('2026-10')).toBe(0);
    expect(await subsSpent(2026, 9)).toBe(0);
    // its card: from what was saved
    const tx = (await (await getDb()).get<{ id: number; occurred_at: number }>('SELECT id, occurred_at FROM transactions'))!;
    expect(await savingOfTransaction(tx.id, 'YANDEX', tx.occurred_at)).toEqual({ before: 4500, after: 0, currency: 'GEL', name: 'Яндекс Плюс' });
  });

  test('a charge paid before the saving was turned on is the month\'s, not the saving\'s', async () => {
    await charge('YANDEX', 4500, '2026-10-05T10:00:00');
    const id = await savePayment({ ...YANDEX, due: '2027-01-05' });
    await startSaving(id, 0);
    // October: its charge and the contribution for January's
    expect(await subsItem('2026-10')).toBe(4500 + 1200);
    expect(await subsSpent(2026, 9)).toBe(4500 + 1200);
  });

  test('turned off: what it had goes to the month (its "Подписки" spend that much less); "Отменить" puts it back', async () => {
    await setPlanBudget('2026-09', 500000, 'GEL');
    const id = await savePayment({ ...YANDEX, due: '2027-01-29' });
    const db = await getDb();
    await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (7, ?, '2026-09', 0)", [id]);
    await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (7, '2026-09', 1000)");
    expect(await savedNow(id)).toBe(1000);
    const stopped = await stopSaving(id);
    expect(stopped?.released).toBe(1000);
    expect(await subsSpent(2026, 9)).toBe(-1000);
    expect(await subsSpent(2026, 8)).toBe(1000);
    await undoSaving(stopped!.undo);
    // October's contribution again: (45 − 10) over October to January, up to whole lari
    expect(await subsSpent(2026, 9)).toBe(900);
  });

  test('turned on and off in one month: nothing left of it; deleting the subscription stops it, "Отменить" brings both', async () => {
    const id = await savePayment({ ...YANDEX, due: '2027-01-29' });
    await startSaving(id, 0);
    const stopped = await stopSaving(id);
    expect(stopped?.released).toBe(0);
    expect(await (await getDb()).all('SELECT * FROM payment_savings')).toEqual([]);
    await undoSaving(stopped!.undo);
    expect(await subsItem('2026-10')).toBe(1200);
    const deleted = await deletePayment(id);
    expect(await subsItem('2026-10')).toBe(0);
    await restorePayment(id, deleted);
    expect(await subsItem('2026-10')).toBe(1200);
  });
});
