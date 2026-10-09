// Builds a demo database for the UI screenshots on the emulator (.github/workflows/android-release.yml):
// a planned previous and current month with limits of every rhythm, obligatory payments and spending outside the
// plan, its dates around today; operations as from SMS (merchants with their categories, new ones, a refund, deposits),
// the card's balance. Usage: npx tsc -p scripts/demo && node dist-demo/scripts/demo/demoDb.js out.db
import fs from 'fs';
import { openDatabase } from '../../src/db/driver';
import { closeDb, getDb, useDb } from '../../src/db';
import { createCategory, findCategoryByName, updateCategory } from '../../src/db/categories';
import { createCategoryType } from '../../src/db/categoryTypes';
import { setRatesFetcher } from '../../src/fx/nbg';
import { NormPeriod, PlanKind, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { recordBalance } from '../../src/db/balance';
import { addMerchantCategory, setMerchantMixed } from '../../src/db/merchants';
import { buy, done, rule } from '../../tests/e2e/seeds';

// GEL only: no rates needed
setRatesFetcher(async () => []);

const lari = (v: number) => Math.round(v * 100);
const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/** noon of that day of the month `ym`, unix seconds */
const at = (ym: string, day: number, hour = 12) => {
  const [y, m] = ym.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, day, hour).getTime() / 1000);
};

/** An SMS of TBC for this operation, in the formats of the real ones (tests/fixtures/tbc_sms_fixtures.json). */
function smsText(r: { kind: string; amount_minor: number; raw_merchant: string; occurred_at: number }) {
  const d = new Date(r.occurred_at * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  const sum = (r.amount_minor / 100).toFixed(2);
  if (r.kind === 'deposit') return `Deposit Money: ${sum} GEL\nMC GOLD\n${day}/${d.getFullYear()}\n${r.raw_merchant}`;
  if (r.kind === 'transfer') return `Money Transfer: ${sum} GEL\nMC GOLD\n${day}/${d.getFullYear()}\n${r.raw_merchant}`;
  return `${sum}GEL\n(*1234)\n${r.raw_merchant}\n${day}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

  // as from SMS: real merchants (their categories follow them), a few new ones without a category
  const buyIn = (key: string | null, merchant: string, amount: number, ym: string, day: number,
    opts: Parameters<typeof buy>[4] = {}) => buy(merchant, amount, at(ym, day, 10 + (day % 9)), key ? ids[key] : null, opts);

  // the previous month: whole, a bit over in places
  for (let d = 1; d <= daysIn(prevYm); d++) {
    await buyIn('food', d % 2 ? 'SPAR' : 'CARREFOUR', 25 + (d * 7) % 30, prevYm, d);
    if (d % 3 === 0) await buyIn('cafe', d % 2 ? 'FABRIKA' : 'LOLITA', 38 + (d % 4) * 9, prevYm, d);
    if (d % 5 === 0) await buyIn('taxi', 'BOLT', 12.9, prevYm, d);
  }
  await buyIn('home', 'NINO K', 1379.33, prevYm, 2, { kind: 'transfer' });
  await buyIn('therapy', 'PSYCHOLOGY CENTER', 585.26, prevYm, 10, { kind: 'payment' });
  await buyIn('subs', 'NETFLIX.COM', 70, prevYm, 15);
  await buyIn('fun', 'CAVEA', 160, prevYm, 20);
  await buyIn('shop', 'ZARA', 240, prevYm, 12);
  await buyIn('beauty', 'BEAUTY ROOM', 180, prevYm, 22);
  await buyIn(null, 'SALARY', 4000, prevYm, 1, { kind: 'deposit' });
  await buyIn(null, 'SALARY', 3500, prevYm, 16, { kind: 'deposit' });

  // this month so far: food on pace, cafes under, taxi over its month, things outside the plan
  for (let d = 1; d <= today; d++) {
    await buyIn('food', d % 2 ? 'SPAR' : 'CARREFOUR', 22 + (d * 5) % 20, thisYm, d);
    if (d % 4 === 1) await buyIn('cafe', 'FABRIKA', 45, thisYm, d);
  }
  for (const d of [1, 2, 3, 4, 5]) if (d <= today) await buyIn('taxi', 'BOLT', 12.9, thisYm, d);
  await buyIn('home', 'NINO K', 1379.33, thisYm, 1, { kind: 'transfer' });
  await buyIn('therapy', 'PSYCHOLOGY CENTER', 145.85, thisYm, Math.min(today, 3), { kind: 'payment' });
  await buyIn('shop', 'ZARA', 125.8, thisYm, Math.min(today, 4));
  await buyIn('shop', 'ZARA', 40, thisYm, Math.min(today, 6), { kind: 'refund' });
  await buyIn('beauty', 'BEAUTY ROOM', 222, thisYm, Math.min(today, 2));
  await buyIn(null, 'SALARY', 4000, thisYm, 1, { kind: 'deposit' });
  // new today: not opened yet, without a category (the dot in the list, the badge on the tab)
  await buyIn(null, 'GLOVO', 7.9, thisYm, today, { unread: true });
  await buyIn(null, 'BURGER HOUSE', 18.5, thisYm, today, { unread: true });

  // the merchants' categories: their new operations get them by themselves
  for (const [m, key] of [['SPAR', 'food'], ['CARREFOUR', 'food'], ['FABRIKA', 'cafe'], ['LOLITA', 'cafe'], ['BOLT', 'taxi'],
    ['NETFLIX.COM', 'subs'], ['CAVEA', 'fun'], ['ZARA', 'shop'], ['BEAUTY ROOM', 'beauty'], ['PSYCHOLOGY CENTER', 'therapy']] as const) await rule(m, ids[key]);
  // GLOVO: food or cafes — each new operation asks
  await setMerchantMixed('GLOVO', true);
  for (const key of ['food', 'cafe']) await addMerchantCategory('GLOVO', ids[key]);

  // the SMS texts as the bank writes them
  const db = await getDb();
  const rows = await db.all<{ id: number; kind: string; amount_minor: number; raw_merchant: string; occurred_at: number }>(
    'SELECT id, kind, amount_minor, raw_merchant, occurred_at FROM transactions');
  for (const r of rows) await db.run('UPDATE transactions SET raw_sms = ? WHERE id = ?', [smsText(r), r.id]);

  // the card's balance from the latest SMS with one
  const last = await db.get<{ id: number; occurred_at: number }>(
    "SELECT id, occurred_at FROM transactions WHERE raw_merchant = 'SPAR' ORDER BY occurred_at DESC LIMIT 1");
  if (last) await recordBalance({ minor: lari(2843.17), currency: 'GEL', at: last.occurred_at, txId: last.id });
  await done();

  const all = await (await getDb()).all<{ id: number }>('SELECT id FROM transactions');
  await closeDb();
  console.log(`demo database: ${out} (${all.length} operations, ${prevYm}–${thisYm})`);
}

main(process.argv[2] ?? 'demo.db').catch((e) => { console.error(e); process.exit(1); });
