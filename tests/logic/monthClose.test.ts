// "Итоги месяца" (db/plans/close.ts, closeWrites.ts): which month to close, its steps and sums, the answers, the carry
// to the next month. Cases by MONTH_CLOSE.md (A1, B2…). Today: 15 October 2026, September is to close.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import {
  answerClose, carryInto, finishClose, fundLedger, getFund, monthClose, monthToClose, OverBudgetError, setSplit, planRateDate, setFund, setPlanBudget,
  storedBudget,
} from '../../src/db/plans';
import { createCategory } from '../../src/db/categories';
import { savingsPlanFact } from '../../src/db/reportSavings';
import { addManualTransaction } from '../../src/db/transactions';

const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
const spend = (amount: number, categoryId: number, when = '2026-09-10T12:00:00') =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: at(when), kind: 'purchase', currency: 'GEL' });
/** September: a budget of 1 000 ₾, `locked` of it 🔒, `spent` spent */
async function september(spent: number, locked = 30000, ym = '2026-09') {
  await setPlanBudget(ym, 100000, 'GEL', 0, true, locked);
  const food = await createCategory('Еда', '🍔');
  if (spent) await spend(spent, food, `${ym}-10T12:00:00`);
  return food;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
});
afterEach(() => jest.useRealTimers());

test('A1, C1–C2: no overspend — "Сколько удалось отложить?" on 🔒 and the leftover ("В сбережения" by default)', async () => {
  await september(50000);
  expect(await monthToClose()).toBe('2026-09');
  const c = await monthClose('2026-09');
  expect(c.steps).toEqual(['savings']);
  expect(c.budget).toMatchObject({ over_minor: 0, kept_locked_minor: 30000, rest_minor: 20000, own_spent_minor: 50000 });
  expect(c.ask_minor).toBe(50000);
  expect(c.planned).toEqual({ funds: [], locked: 30000, rest: 20000 });
  expect(c.answers.rest_choice).toBe('savings');
  expect(c.complete).toBe(false);
  expect(await finishClose('2026-09')).toBe(false);

  await answerClose('2026-09', { saved: 'yes' });
  expect(await monthClose('2026-09')).toMatchObject({ saved_minor: 50000, complete: true });
  expect(await finishClose('2026-09')).toBe(true);
  expect(await monthToClose()).toBeNull();
  expect(await carryInto('2026-10')).toBeNull();
});

test('C3–C4, C10: the leftover moved to October — asked about 🔒 alone, October gets it; nothing to put aside — not asked', async () => {
  await september(50000);
  await answerClose('2026-09', { rest_choice: 'next' });
  expect((await monthClose('2026-09')).ask_minor).toBe(30000);
  await answerClose('2026-09', { saved: 'other', saved_minor: 25000 });
  expect(await monthClose('2026-09')).toMatchObject({ saved_minor: 25000, carry: { debt_minor: 0, plus_minor: 20000 } });
  await finishClose('2026-09');
  expect(await carryInto('2026-10')).toEqual({ from_ym: '2026-09', debt_minor: 0, plus_minor: 20000, currency: 'GEL' });

  // "Покрыть иначе" from October: the leftover to savings after all — the carry goes, "Удалось отложить?" is on both
  await answerClose('2026-09', { rest_choice: 'savings', saved: 'yes' });
  expect(await carryInto('2026-10')).toBeNull();
  expect(await monthClose('2026-09')).toMatchObject({ saved_minor: 50000, closed: true });
});

test('C4: no 🔒 and the leftover kept as is (answered so before "Оставить как есть" went) — nothing asked, it closes', async () => {
  await september(50000, 0);
  await answerClose('2026-09', { rest_choice: 'keep' });
  expect(await monthClose('2026-09')).toMatchObject({ steps: [], ask_minor: 0, complete: true, saved_minor: null });
});

test('B1, C5–C6: an overspend 🔒 covers — from savings by default (🔒 less it); from October — 🔒 whole, October owes it', async () => {
  await september(80000);
  let c = await monthClose('2026-09');
  expect(c.steps).toEqual(['over', 'savings']);
  expect(c.answers.over_cover).toBe('savings');
  expect(c.budget).toMatchObject({ over_minor: 10000, from_savings_minor: 10000, over_rest_minor: 0, kept_locked_minor: 20000, rest_minor: 0 });
  expect(c.ask_minor).toBe(20000);

  await answerClose('2026-09', { over_cover: 'next', saved: 'yes' });
  c = await monthClose('2026-09');
  expect(c).toMatchObject({ saved_minor: 30000, carry: { debt_minor: 10000, plus_minor: 0 }, complete: true });
  await finishClose('2026-09');
  expect(await carryInto('2026-10')).toMatchObject({ debt_minor: 10000, plus_minor: 0 });

  await answerClose('2026-09', { over_cover: 'covered' });
  expect(await carryInto('2026-10')).toBeNull();
});

test('B2: an overspend bigger than 🔒 — what it doesn\'t cover goes to October by default; 🔒 spent whole — no savings step', async () => {
  await september(110000, 5000);
  const c = await monthClose('2026-09');
  expect(c.budget).toMatchObject({ over_minor: 15000, from_savings_minor: 5000, over_rest_minor: 10000, kept_locked_minor: 0, rest_minor: 0 });
  expect(c.steps).toEqual(['over']);
  expect(c.answers.over_rest_cover).toBe('next');
  expect(c).toMatchObject({ complete: true, carry: { debt_minor: 10000 } });
});

test('B3: no 🔒 — nothing chosen for the overspend until answered', async () => {
  await september(110000, 0);
  expect(await monthClose('2026-09')).toMatchObject({ answers: { over_cover: null }, complete: false });
  await answerClose('2026-09', { over_cover: 'covered' });
  expect(await monthClose('2026-09')).toMatchObject({ complete: true, carry: { debt_minor: 0 } });
});

test('D1–D3: the funds\' contributions are asked with the savings — laid out the nearest due first, then 🔒, then the leftover', async () => {
  await september(50000, 0);
  const id = await createCategory('Отпуск', '🏖');
  await setFund('2026-09', id, { target_minor: 300000, currency: 'GEL', due: '2027-07-31', start_minor: 0 }, '2026-09');
  const near = await createCategory('Страховка', '🛡');
  await setFund('2026-09', near, { target_minor: 20000, currency: 'GEL', due: '2026-12-31', start_minor: 0 }, '2026-09');
  let c = await monthClose('2026-09');
  expect(c.funds.map((f) => [f.name, f.planned_minor, f.confirmed_minor])).toEqual([['Отпуск', 27300, null], ['Страховка', 5000, null]]);
  const fund = (await getFund(id))!;
  // unanswered: not in it
  expect((await fundLedger(fund, '2026-09')).balance).toBe(0);
  expect(c.steps).toEqual(['savings']);
  // the contributions as planned are the month's: what is left of the budget is them and the leftover
  expect(c.budget).toMatchObject({ spent_minor: 82300, rest_minor: 17700, own_spent_minor: 50000 });
  expect(c.ask_minor).toBe(50000);
  expect(c.planned.funds.map((f) => f.minor)).toEqual([5000, 27300]);

  // less than planned: the nearest due first, the leftover gets nothing
  await answerClose('2026-09', { saved: 'other', saved_minor: 20000 });
  c = await monthClose('2026-09');
  expect(c.split).toMatchObject({ funds: [{ category_id: near, minor: 5000 }, { category_id: id, minor: 15000 }], locked: 0, rest: 0 });
  expect(c).toMatchObject({ saved_minor: 0, complete: true });
  expect((await fundLedger(fund, '2026-09')).balance).toBe(15000);

  // by hand: the fund more, the savings the rest
  await setSplit('2026-09', [{ category_id: near, minor: 0 }, { category_id: id, minor: 12000 }]);
  c = await monthClose('2026-09');
  expect(c.split).toMatchObject({ funds: [{ minor: 0 }, { minor: 12000 }], locked: 0, rest: 8000 });
  expect(c.saved_minor).toBe(8000);
  // a new answer lays it out again
  await answerClose('2026-09', { saved: 'yes' });
  expect((await monthClose('2026-09')).split).toMatchObject({ funds: [{ minor: 5000 }, { minor: 27300 }], rest: 17700 });
});

test('A2: a plan without a budget or funds has nothing to ask — closed on the way', async () => {
  const food = await createCategory('Еда', '🍔');
  const db = await getDb();
  await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09')");
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor) VALUES ('2026-09', ?, 20000)", [food]);
  expect(await monthToClose()).toBeNull();
  expect(await db.get("SELECT closed_at IS NOT NULL AS closed FROM month_closes WHERE ym = '2026-09'")).toEqual({ closed: 1 });
});

test('A4: two months open — the oldest first; its next month is over, so nothing goes to it', async () => {
  await september(110000, 0, '2026-08');
  await setPlanBudget('2026-09', 100000, 'GEL', 0, true, 0);
  expect(await monthToClose()).toBe('2026-08');
  const c = await monthClose('2026-08');
  expect(c).toMatchObject({ can_carry: false, answers: { over_cover: 'covered' }, complete: true });
});

test('the leftover\'s default is the last closed month\'s choice; answers are kept before closing', async () => {
  await september(50000, 0, '2026-08');
  await answerClose('2026-08', { rest_choice: 'next' });
  await finishClose('2026-08');
  await spend(50000, (await createCategory('Кафе', '☕')), '2026-09-12T12:00:00');
  await setPlanBudget('2026-09', 100000, 'GEL', 0, true, 0);
  expect((await monthClose('2026-09')).answers.rest_choice).toBe('next');
  // one kept as is ("Оставить как есть" is no longer asked): the next goes to savings
  await answerClose('2026-08', { rest_choice: 'keep' });
  expect((await monthClose('2026-09')).answers.rest_choice).toBe('savings');
  await answerClose('2026-09', { rest_choice: 'next' });
  expect(await monthClose('2026-09')).toMatchObject({ answers: { rest_choice: 'next' }, closed: false, carry: { plus_minor: 50000 } });
  // not closed yet: October gets nothing
  expect(await carryInto('2026-10')).toBeNull();
});

test('B4–B6, C10: October\'s budget gets the carry — plannable less what is owed, plus the leftover moved; a plan past it refused', async () => {
  await september(80000);
  await answerClose('2026-09', { over_cover: 'next', saved: 'yes' });
  await finishClose('2026-09');
  // no October budget yet: kept for when there is one
  expect(await storedBudget('2026-10')).toBeNull();
  // 1 000 less September's 🔒 300 (carried over), less what it owes
  await setPlanBudget('2026-10', 100000);
  expect(await storedBudget('2026-10')).toMatchObject({ plannable_minor: 60000, carry: { from_ym: '2026-09', debt_minor: 10000, plus_minor: 0 } });
  await expect(setPlanBudget('2026-10', 5000)).rejects.toBeInstanceOf(OverBudgetError);

  await answerClose('2026-09', { over_cover: 'covered' });
  expect(await storedBudget('2026-10')).toMatchObject({ plannable_minor: 70000, carry: null });
});

test('B5: a carry from a budget in another currency — converted on October\'s rate', async () => {
  const db = await getDb();
  await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [planRateDate('2026-10')]);
  await setPlanBudget('2026-10', 100000, 'GEL');
  await db.run("INSERT INTO month_closes (ym, closed_at, carry_plus_minor, carry_currency) VALUES ('2026-09', 1, 10000, 'USD')");
  expect(await storedBudget('2026-10')).toMatchObject({ plannable_minor: 125000, carry: { plus_minor: 25000 } });
});

test('the report\'s plan and fact: what was put aside laid out — the fund, then 🔒, then the leftover', async () => {
  await september(50000);
  const id = await createCategory('Отпуск', '🏖');
  await setFund('2026-09', id, { target_minor: 300000, currency: 'GEL', due: '2027-07-31', start_minor: 0 }, '2026-09');
  expect(await savingsPlanFact('2026-09', 'GEL')).toMatchObject({
    closed: false, locked: { plan: 30000, fact: null }, rest: null, fact: null,
  });
  await answerClose('2026-09', { saved: 'other', saved_minor: 40000 });
  await finishClose('2026-09');
  const pf = (await savingsPlanFact('2026-09', 'GEL'))!;
  // 1 000 − 500 spent − the fund's 273: 🔒 300 less the 73 over — 227; 400 put aside: the fund's 273, 🔒 127
  expect(pf).toMatchObject({ closed: true, locked: { plan: 30000, fact: 12700 }, funds: [{ plan: 27300, fact: 27300 }], fact: 40000 });
  expect(pf.rest).toBeNull();
});

test('the report\'s plan and fact: the leftover moved — apart, not in the totals; closed by the migration — no facts', async () => {
  await september(50000);
  await answerClose('2026-09', { rest_choice: 'next', saved: 'yes' });
  await finishClose('2026-09');
  expect(await savingsPlanFact('2026-09', 'GEL')).toMatchObject({ rest: { plan: 20000, fact: null, choice: 'next' }, plan: 30000, fact: 30000 });
  await (await getDb()).run("UPDATE month_closes SET saved = NULL, saved_minor = NULL WHERE ym = '2026-09'");
  expect(await savingsPlanFact('2026-09', 'GEL')).toMatchObject({ closed: false, fact: null });
});
