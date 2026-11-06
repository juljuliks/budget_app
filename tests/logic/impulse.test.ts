// Impulsive purchases counted: the answers of a period, the month's report block, the operations' "Покупка: без ответа".
import { getDb } from '../../src/db';
import { setTransactionImpulse, setTransactionMood } from '../../src/db/impulse';
import { impulseRows } from '../../src/db/impulseStats';
import { setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { monthReport } from '../../src/db/report';
import { addManualTransaction, listTransactionsFiltered } from '../../src/db/transactions';
import { impulseByCategory, impulseByMonth, impulseMerchants, impulseSummary } from '../../src/stats/impulse';
import { impulseTrendView, impulseWindow } from '../../src/screens/stats/trends/model/impulseTrendView';
import { freshDb } from '../helpers';

beforeEach(() => freshDb());

const at = (d: string) => Math.floor(new Date(`${d}T12:00:00`).getTime() / 1000);
const SEP = [at('2026-09-01'), at('2026-10-01')] as const;

async function setup() {
  const db = await getDb();
  const cat = async (name: string, impulse: number) => Number((await db.run('INSERT INTO categories (name, impulse) VALUES (?, ?)', [name, impulse])).lastInsertRowid);
  const cafe = await cat('Кафе', 1), clothes = await cat('Одежда', 1), food = await cat('Продукты', 0);
  const buy = async (cents: number, category: number, day: string, merchant: string, impulse: boolean | null, mood: string | null = null) => {
    const id = await addManualTransaction({ amount_minor: cents, category_id: category, occurred_at: at(day) });
    await db.run('UPDATE transactions SET raw_merchant = ?, merchant_key = ? WHERE id = ?', [merchant, merchant, id]);
    if (impulse !== null) await setTransactionImpulse(id, impulse);
    if (mood) await setTransactionMood(id, mood as never);
    return id;
  };
  return { db, cafe, clothes, food, buy };
}

test('a period\'s answers: asked or answered purchases; impulsive against considered, what pushed, by category', async () => {
  const { cafe, clothes, food, buy } = await setup();
  await buy(1200, cafe, '2026-09-03', 'WOLT', true, 'bored');
  await buy(1800, cafe, '2026-09-04', 'WOLT', true, 'bored');
  await buy(1000, cafe, '2026-09-05', 'WOLT', true, 'anxious');
  await buy(3000, cafe, '2026-09-06', 'BARI', false);
  await buy(500, cafe, '2026-09-07', 'BARI', null); // asked, no answer
  await buy(4000, clothes, '2026-09-08', 'ZARA', true);
  await buy(2000, food, '2026-09-09', 'SPAR', null); // not asked: «Продукты» off
  const s = impulseSummary(await impulseRows(SEP[0], SEP[1], 'GEL'));
  expect(s.asked).toBe(6);
  expect(s.answered).toBe(5);
  expect(s.impulsive).toEqual({ count: 4, sum: 8000 });
  expect(s.intentional).toEqual({ count: 1, sum: 3000 });
  expect(s.moods).toEqual([{ mood: 'bored', count: 2, sum: 3000 }, { mood: 'anxious', count: 1, sum: 1000 }]);
  const by = impulseByCategory(await impulseRows(SEP[0], SEP[1], 'GEL'));
  expect(by.get(cafe)).toEqual({ answered: 4, impulsive: { count: 3, sum: 4000 } });
  expect(by.get(clothes)).toEqual({ answered: 1, impulsive: { count: 1, sum: 4000 } });
  // where: two answers at least, the biggest share first
  expect(impulseMerchants(await impulseRows(SEP[0], SEP[1], 'GEL', cafe)).map((m) => `${m.name} ${m.impulsive}/${m.answered}`)).toEqual(['WOLT 3/3']);
});

test('"Обдуманная" takes the mood away; a mood of an older considered answer is not counted', async () => {
  const { db, cafe, buy } = await setup();
  const id = await buy(1000, cafe, '2026-09-03', 'WOLT', true, 'sad');
  await setTransactionImpulse(id, false);
  expect((await db.get<{ m: string | null }>('SELECT mood AS m FROM transactions WHERE id = ?', [id]))!.m).toBeNull();
  // as left by the first version (the mood asked of any answer)
  await db.run("UPDATE transactions SET mood = 'sad' WHERE id = ?", [id]);
  expect(impulseSummary(await impulseRows(SEP[0], SEP[1], 'GEL')).moods).toEqual([]);
});

test('the month\'s report: its block with each category against its plan; nothing answered — no block', async () => {
  const { cafe, clothes, buy } = await setup();
  expect((await monthReport('2026-09', 'GEL')).impulse).toBeNull();
  await setPlanBudget('2026-09', 100000, 'GEL', 10);
  await setPlanAmount('2026-09', cafe, 5000, 'limit');
  await buy(4000, cafe, '2026-09-03', 'WOLT', true);
  await buy(3000, cafe, '2026-09-04', 'BARI', false); // cafe 70 of 50: 20 over
  await buy(1500, clothes, '2026-09-05', 'ZARA', true); // not in the plan
  const m = (await monthReport('2026-09', 'GEL')).impulse!;
  expect(m.answered).toBe(3);
  expect(m.categories.map((c) => [c.name, c.impulsive, c.answered, c.impulsiveSum, c.over])).toEqual([
    ['Кафе', 1, 2, 4000, 2000],
    ['Одежда', 1, 1, 1500, null],
  ]);
});

test('"Покупка: без ответа": the asked purchases with no answer, a split one by any part in such a category', async () => {
  const { db, cafe, food, buy } = await setup();
  const open = await buy(1000, cafe, '2026-09-03', 'WOLT', null);
  await buy(1000, cafe, '2026-09-04', 'WOLT', true);
  await buy(1000, food, '2026-09-05', 'SPAR', null);
  const split = await buy(3000, food, '2026-09-06', 'CARREFOUR', null);
  await db.run('INSERT INTO transaction_parts (tx_id, category_id, amount_minor) VALUES (?, ?, ?)', [split, cafe, 1000]);
  const ids = (await listTransactionsFiltered({ unanswered: true })).map((r) => r.id).sort();
  expect(ids).toEqual([open, split].sort());
});

test('a category\'s dynamics: 3 months, under 10 answers — how many; the months\' shares when two have answers', async () => {
  const { cafe, buy } = await setup();
  expect(impulseWindow('2026-10-15')).toEqual({ from: '2026-08-01', to: '2026-10-15' });
  for (let i = 0; i < 4; i++) await buy(1000, cafe, `2026-09-1${i}`, 'WOLT', i < 3);
  const [from, to] = [at('2026-08-01'), at('2026-10-16')];
  let v = impulseTrendView(await impulseRows(from, to, 'GEL', cafe), true, '2026-10-15')!;
  expect(v.enough).toBe(false);
  expect(v.summary.answered).toBe(4);
  expect(v.months).toBeNull();
  for (let i = 0; i < 6; i++) await buy(1000, cafe, `2026-10-0${i + 1}`, 'BARI', i < 2);
  v = impulseTrendView(await impulseRows(from, to, 'GEL', cafe), true, '2026-10-15')!;
  expect(v.enough).toBe(true);
  expect(v.months!.map((m) => [m.label, m.share])).toEqual([['авг', null], ['сен', 0.75], ['окт', 2 / 6]]);
  // off and nothing answered: no block
  expect(impulseTrendView([], false, '2026-10-15')).toBeNull();
  expect(impulseByMonth([])).toEqual([]);
});
