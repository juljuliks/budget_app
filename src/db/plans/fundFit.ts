// A month's funds' contributions fitted to its budget, without asking: what is free in the plan first, then
// "🔒 Отложить сразу" (part of it too), what still doesn't fit is 0 this month — the next ones ask more (left to save
// over the months left). No budget — all of it. Written to the funds' plan items: limit_minor (what goes in),
// cap_minor (what fitted, when less than it asks), taken_minor (of it from 🔒, in the budget's currency).
import { getDb } from '../index';
import { activeFunds, contributionOf, fundLedger } from './funds';
import { planConverter, storedBudget } from './budget';

/**
 * Fits the funds of `ym` (one of the current and the coming months) anew: counted as if what they took from 🔒 last
 * time were back there, then written at once — a read meanwhile sees the last fit, never a half-made one.
 */
export async function fitFunds(ym: string, nowYm: string): Promise<void> {
  const db = await getDb();
  const items = await db.all<{ category_id: number; taken_minor: number }>(
    "SELECT category_id, taken_minor FROM plan_items WHERE ym = ? AND kind = 'fund'", [ym]);
  if (!items.length) return;
  const month = await db.get<{ m: number }>('SELECT locked_is_max AS m FROM plan_months WHERE ym = ?', [ym]);
  // "MAX": 🔒 is whatever the plan leaves — it follows the items by itself
  const max = month?.m === 1;
  const before = max ? 0 : items.reduce((a, i) => a + i.taken_minor, 0);

  const budget = await storedBudget(ym);
  const conv = await planConverter(ym);
  let free = Infinity;
  let locked = 0;
  if (budget) {
    const others = (await db.all<{ limit_minor: number; currency: string }>(
      "SELECT limit_minor, currency FROM plan_items WHERE ym = ? AND kind != 'fund'", [ym]))
      .reduce((a, r) => a + (conv(r.limit_minor, r.currency, budget.currency) ?? 0), 0);
    // what the last fit took is 🔒's again (and not the plan's)
    const room = Math.max(0, budget.plannable_minor - before - others);
    free = max ? 0 : room;
    locked = max ? Math.max(0, budget.plannable_minor - others) : budget.locked_minor + before;
  }
  // the older first: a new fund doesn't take an older one's place
  const funds = (await activeFunds(ym, db)).filter((f) => items.some((i) => i.category_id === f.category_id))
    .sort((a, b) => (a.since_ym < b.since_ym ? -1 : a.since_ym > b.since_ym ? 1 : a.category_id - b.category_id));
  const writes: Array<{ id: number; put: number; cap: number | null; taken: number; currency: string }> = [];
  let taken = 0;
  for (const fund of funds) {
    const months = (await fundLedger(fund, ym, nowYm)).months;
    const m = months[months.length - 1];
    // what it asks: from what it has at the month's start (this month's own cap aside)
    const asked = m ? contributionOf(fund, ym, m.start) : 0;
    let put = asked;
    let fromLocked = 0;
    if (budget && asked > 0) {
      const need = conv(asked, fund.currency, budget.currency) ?? asked;
      const give = Math.min(need, free);
      free -= give;
      fromLocked = Math.min(need - give, Math.max(0, locked));
      locked -= fromLocked;
      const got = give + fromLocked;
      // back in the fund's currency, whole units: never more than it asks
      put = got >= need ? asked : Math.min(asked, Math.floor((conv(got, budget.currency, fund.currency) ?? got) / 100) * 100);
    }
    writes.push({ id: fund.category_id, put, cap: put < asked ? put : null, taken: fromLocked, currency: fund.currency });
    taken += fromLocked;
  }
  await db.transaction(async (t) => {
    for (const w of writes) {
      await t.run("UPDATE plan_items SET limit_minor = ?, currency = ?, cap_minor = ?, taken_minor = ? WHERE ym = ? AND category_id = ? AND kind = 'fund'",
        [w.put, w.currency, w.cap, w.taken, ym, w.id]);
    }
    if (!max && taken !== before) await t.run('UPDATE plan_months SET locked_minor = max(0, locked_minor + ? - ?) WHERE ym = ?', [before, taken, ym]);
  });
}
