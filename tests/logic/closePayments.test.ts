// "Итоги месяца", step "Платежи" (db/plans/closePayments.ts): the one-off payments not paid — moved to the next month
// with their money, or not needed. Today: 15 October 2026, September is to close.
import { freshDb } from '../helpers';
import { answerClosePayment, answerClose, finishClose, listPlan, monthClose, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { createCategory } from '../../src/db/categories';
import { addManualTransaction } from '../../src/db/transactions';

const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
const spend = (amount: number, categoryId: number) =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: at('2026-09-10T12:00:00'), kind: 'purchase', currency: 'GEL' });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
});
afterEach(() => jest.useRealTimers());

/** September: a budget of 1 000 ₾, nothing 🔒; Ремонт 300 not paid, Подарки 200 — 150 paid, Такси 100 a limit */
async function september() {
  await setPlanBudget('2026-09', 100000, 'GEL', 0, true, 0);
  const repair = await createCategory('Ремонт', '🔧');
  const gifts = await createCategory('Подарки', '🎁');
  const taxi = await createCategory('Такси', '🚕');
  await setPlanAmount('2026-09', repair, 30000, 'fixed');
  await setPlanAmount('2026-09', gifts, 20000, 'fixed');
  await setPlanAmount('2026-09', taxi, 10000, 'limit');
  await spend(15000, gifts);
  return { repair, gifts, taxi };
}

test('the step: the one-off payments with something not paid (the rest of a part paid); a limit isn\'t asked', async () => {
  const { repair, gifts } = await september();
  const c = await monthClose('2026-09');
  expect(c.steps[0]).toBe('payments');
  expect(c.payments.map((p) => ({ id: p.category_id, unpaid: p.unpaid_minor, paid: p.paid_minor, choice: p.choice }))).toEqual([
    { id: repair, unpaid: 30000, paid: 0, choice: null }, { id: gifts, unpaid: 5000, paid: 15000, choice: null }]);
  await answerClose('2026-09', { saved: 'yes' });
  expect((await monthClose('2026-09')).complete).toBe(false);
});

test('moved on: in the next month\'s plan, its money in the leftover moved — the savings ask the rest; not needed: stays the leftover', async () => {
  const { repair, gifts } = await september();
  const before = (await monthClose('2026-09')).budget!.rest_minor;
  await answerClosePayment('2026-09', repair, 'next');
  await answerClosePayment('2026-09', gifts, 'drop');
  const c = await monthClose('2026-09');
  expect(c.moved_minor).toBe(30000);
  expect(c.budget!.rest_minor).toBe(before - 30000);
  expect(c.carry.plus_minor).toBe(30000);
  await answerClose('2026-09', { saved: 'yes' });
  expect(await finishClose('2026-09')).toBe(true);
  const oct = await listPlan('2026-10');
  expect(oct.find((i) => i.category_id === repair)).toMatchObject({ kind: 'fixed', limit_minor: 30000 });
  // not needed: nothing of it moves (a category with no kind yet comes as before — empty)
  expect(oct.find((i) => i.category_id === gifts)?.limit_minor ?? 0).toBe(0);
  // closed again ("Изменить итоги"): not added twice
  expect(await finishClose('2026-09')).toBe(true);
  expect((await listPlan('2026-10')).find((i) => i.category_id === repair)).toMatchObject({ limit_minor: 30000 });
});

test('the next month has it already: the sums add up', async () => {
  const { repair } = await september();
  await setPlanAmount('2026-10', repair, 10000, 'fixed');
  await answerClosePayment('2026-09', repair, 'next');
  await answerClosePayment('2026-09', (await monthClose('2026-09')).payments[1].category_id, 'drop');
  await answerClose('2026-09', { saved: 'yes' });
  await finishClose('2026-09');
  expect((await listPlan('2026-10')).find((i) => i.category_id === repair)).toMatchObject({ limit_minor: 40000 });
});
