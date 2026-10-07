import { freshDb } from './helpers';
import { getDb } from '../src/db';
import { createRule } from '../src/categorize';
import { createCategory, listCategories } from '../src/db/categories';
import { mergeCategories, MergeNameTakenError, mergedName } from '../src/db/mergeCategories';

const at = (y: number, m: number, d: number) => Math.floor(new Date(y, m - 1, d, 12).getTime() / 1000);
let seq = 0;

async function tx(categoryId: number, occurredAt: number, merchant: string, source = 'rule') {
  const db = await getDb();
  return (await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', 100, 'GEL', ?, ?, ?, ?, '', ?)`, [merchant, categoryId, source, occurredAt, `m${seq++}`])).lastInsertRowid;
}

async function plan(ym: string, categoryId: number, minor: number, kind = 'limit', norm = 'day', pinned = 0) {
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
  await db.run('INSERT INTO plan_items (ym, category_id, limit_minor, currency, kind, norm_period, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [ym, categoryId, minor, 'GEL', kind, norm, pinned]);
}

beforeEach(async () => { await freshDb(); });

test('merging moves every month\'s operations, rules and plan into the target and removes the others', async () => {
  const cafe = await createCategory('Кафе', '☕️');
  const bars = await createCategory('Рестораны', '🍽');
  const old = await tx(bars, at(2026, 8, 3), 'FABRIKA');
  const now = await tx(cafe, at(2026, 10, 2), 'COFFEE');
  const db = await getDb();
  await createRule('exact', 'FABRIKA', bars);
  await plan('2026-08', bars, 30000, 'limit', 'week');
  await plan('2026-10', cafe, 43000, 'limit', 'day', 1);
  await plan('2026-10', bars, 30000, 'limit', 'week');

  await mergeCategories(cafe, [bars], 'Кафе & Рестораны', null, { kind: 'limit', norm: 'week' });

  const cat = (id: number) => db.get<{ category_id: number; category_source: string }>('SELECT category_id, category_source FROM transactions WHERE id = ?', [id]);
  expect(await cat(old)).toEqual({ category_id: cafe, category_source: 'rule' });
  expect(await cat(now)).toEqual({ category_id: cafe, category_source: 'rule' });
  expect(await db.get('SELECT category_id FROM merchant_rules WHERE pattern = ?', ['FABRIKA'])).toEqual({ category_id: cafe });
  expect(await db.all('SELECT ym, category_id, limit_minor, kind, norm_period, pinned FROM plan_items ORDER BY ym')).toEqual([
    { ym: '2026-08', category_id: cafe, limit_minor: 30000, kind: 'limit', norm_period: 'week', pinned: 0 },
    { ym: '2026-10', category_id: cafe, limit_minor: 73000, kind: 'limit', norm_period: 'week', pinned: 1 },
  ]);
  const cats = await listCategories();
  expect(cats.find((c) => c.id === cafe)!.name).toBe('Кафе & Рестораны');
  expect(cats.some((c) => c.id === bars)).toBe(false);
  expect(await db.get('SELECT id FROM categories WHERE id = ?', [bars])).toBeUndefined();
});

test('without a chosen rhythm the target\'s kind and pattern stay', async () => {
  const a = await createCategory('A');
  const b = await createCategory('B');
  await plan('2026-10', a, 1000, 'fixed', 'month');
  await plan('2026-10', b, 500, 'limit', 'day');
  await mergeCategories(a, [b], 'A', null, null);
  const db = await getDb();
  expect(await db.get('SELECT limit_minor, kind, norm_period FROM plan_items')).toEqual({ limit_minor: 1500, kind: 'fixed', norm_period: 'month' });
});

test('a name taken by another category of the section is refused', async () => {
  const a = await createCategory('A');
  const b = await createCategory('B');
  await createCategory('Taken');
  await expect(mergeCategories(a, [b], 'taken', null, null)).rejects.toBeInstanceOf(MergeNameTakenError);
  // one of the merged ones' names is fine
  await mergeCategories(a, [b], 'B', null, null);
  expect((await listCategories()).find((c) => c.id === a)!.name).toBe('B');
});

test('mergedName joins the names in the order picked', () => {
  expect(mergedName([{ name: 'Кафе ' }, { name: 'Рестораны' }])).toBe('Кафе & Рестораны');
});
