// Builds a demo database for the UI screenshots on the emulator (.github/workflows/android-release.yml):
// a planned previous and current month with limits of every rhythm, obligatory payments and spending outside the
// plan, its dates around today. Usage: npx tsc -p scripts/demo && node dist-demo/scripts/demo/demoDb.js out.db
import fs from 'fs';
import { openDatabase } from '../../src/db/driver';
import { closeDb, getDb, useDb } from '../../src/db';
import { createCategory, findCategoryByName, updateCategory } from '../../src/db/categories';
import { createCategoryType } from '../../src/db/categoryTypes';
import { setRatesFetcher } from '../../src/db/fx';
import { NormPeriod, PlanKind, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { addManualTransaction, markTransactionsSeen } from '../../src/db/transactions';

// GEL only: no rates needed
setRatesFetcher(async () => []);

const lari = (v: number) => Math.round(v * 100);
const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/** noon of that day of the month `ym`, unix seconds */
const at = (ym: string, day: number, hour = 12) => {
  const [y, m] = ym.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, day, hour).getTime() / 1000);
};

type Cat = { name: string; emoji: string; type?: string };
const CATS: Record<string, Cat> = {
  food: { name: 'Продукты', emoji: '🛒', type: 'Жизнь' },
  cafe: { name: 'Кафе и рестораны', emoji: '☕️', type: 'Жизнь' },
  taxi: { name: 'Такси', emoji: '🚕' },
  home: { name: 'Аренда', emoji: '🏠', type: 'Жизнь' },
  therapy: { name: 'Психотерапия', emoji: '🤕', type: 'Здоровье' },
  teeth: { name: 'Зубы', emoji: '🦷', type: 'Здоровье' },
  subs: { name: 'Подписки', emoji: '📺' },
  fun: { name: 'Развлечения', emoji: '🎮' },
  shop: { name: 'Покупки', emoji: '🛍️' },
  beauty: { name: 'Красота', emoji: '💅', type: 'Жизнь' },
};

/** [category, amount ₾, kind, rhythm] */
const PLAN: Array<[keyof typeof CATS, number, PlanKind, NormPeriod]> = [
  ['food', 1000, 'limit', 'day'],
  ['cafe', 430, 'limit', 'week'],
  ['taxi', 50, 'limit', 'week'],
  ['fun', 200, 'limit', '2weeks'],
  ['teeth', 1000, 'limit', 'month'],
  ['home', 1379.33, 'fixed', 'month'],
  ['therapy', 585.26, 'fixed', 'month'],
  ['subs', 70, 'fixed', 'month'],
];

async function main(out: string) {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await useDb(openDatabase(out));

  const types = new Map<string, number>();
  const ids: Record<string, number> = {};
  for (const [key, c] of Object.entries(CATS)) {
    let typeId: number | null = null;
    if (c.type) {
      typeId = types.get(c.type) ?? await createCategoryType(c.type);
      types.set(c.type, typeId);
    }
    const existing = await findCategoryByName(c.name, null);
    if (existing) {
      await updateCategory(existing.id, { name: c.name, emoji: c.emoji, typeId });
      ids[key] = existing.id;
    } else {
      ids[key] = await createCategory(c.name, c.emoji, typeId);
    }
  }

  const now = new Date();
  const today = now.getDate();
  const thisYm = ymOf(now);
  const prevYm = ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const daysIn = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

  for (const ym of [prevYm, thisYm]) {
    await setPlanBudget(ym, lari(10410), 'GEL', undefined, true, lari(3123), lari(520.5));
    for (const [key, amount, kind, rhythm] of PLAN) await setPlanAmount(ym, ids[key], lari(amount), kind, 'GEL', rhythm);
  }

  const add = (key: string, amount: number, ym: string, day: number, description?: string) =>
    addManualTransaction({ amount_minor: lari(amount), currency: 'GEL', category_id: ids[key], occurred_at: at(ym, day), description });

  // the previous month: whole, a bit over in places
  for (let d = 1; d <= daysIn(prevYm); d++) {
    await add('food', 25 + (d * 7) % 30, prevYm, d, 'Spar');
    if (d % 3 === 0) await add('cafe', 38 + (d % 4) * 9, prevYm, d, 'Fabrika');
    if (d % 5 === 0) await add('taxi', 12.9, prevYm, d, 'Bolt');
  }
  await add('home', 1379.33, prevYm, 2, 'Аренда');
  await add('therapy', 585.26, prevYm, 10, 'Терапевт');
  await add('subs', 70, prevYm, 15, 'Netflix');
  await add('fun', 160, prevYm, 20, 'Кино');
  await add('shop', 240, prevYm, 12, 'Zara');
  await add('beauty', 180, prevYm, 22, 'Салон');

  // this month so far: food on pace, cafes under, taxi over its month, things outside the plan
  for (let d = 1; d <= today; d++) {
    await add('food', 22 + (d * 5) % 20, thisYm, d, 'Spar');
    if (d % 4 === 1) await add('cafe', 45, thisYm, d, 'Fabrika');
  }
  for (const d of [1, 2, 3, 4, 5]) if (d <= today) await add('taxi', 12.9, thisYm, d, 'Bolt');
  await add('home', 1379.33, thisYm, 1, 'Аренда');
  await add('therapy', 145.85, thisYm, Math.min(today, 3), 'Терапевт');
  await add('shop', 125.8, thisYm, Math.min(today, 4), 'Zara');
  await add('beauty', 222, thisYm, Math.min(today, 2), 'Салон');
  await addManualTransaction({ amount_minor: lari(7.9), currency: 'GEL', category_id: null, occurred_at: at(thisYm, today, 9), description: 'Glovo' });

  const db = await getDb();
  const all = await db.all<{ id: number }>('SELECT id FROM transactions');
  await markTransactionsSeen(all.map((r) => r.id));
  await closeDb();
  console.log(`demo database: ${out} (${all.length} operations, ${prevYm}–${thisYm})`);
}

main(process.argv[2] ?? 'demo.db').catch((e) => { console.error(e); process.exit(1); });
