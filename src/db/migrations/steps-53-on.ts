// The schema's history, migrations 53 and on (shipped ones are never edited).
import type { MigrationStep } from './step';

/** Migrations 53 and on: a new one is appended to the last file (when it nears 250 lines, the next file starts). */
export const STEPS_53_ON: MigrationStep[][] = [
  // 53: a regular category's item was stored in the budget's currency (750 ₾ as 288.61 $, shown as 749.99 ₾ — a
  // kopeck over the plan); 48 left such ones as one-off payments. The current and coming months' payments in the
  // budget's currency that come to whole lari (±2 tetri) by the plan's rate are in lari again, whole
  [
    async (db) => {
      const now = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
      const today = `${ym}-${p2(now.getDate())}`;
      const rows = await db.all<{ ym: string; category_id: number; limit_minor: number; currency: string }>(
        `SELECT p.ym, p.category_id, p.limit_minor, p.currency FROM plan_items p JOIN plan_months m ON m.ym = p.ym
          WHERE p.ym >= ? AND p.kind IN ('fixed', 'subs') AND p.currency = m.budget_currency AND p.currency <> 'GEL' AND p.limit_minor > 0
            -- converted ones have cents; one typed in dollars is whole and stays
            AND p.limit_minor % 100 <> 0`,
        [ym],
      );
      for (const r of rows) {
        // the plan's rate: its month's last day, not after today (as planRateDate)
        const [y, m] = r.ym.split('-').map(Number);
        const last = `${r.ym}-${p2(new Date(y, m, 0).getDate())}`;
        const day = last < today ? last : today;
        const rate = (
          await db.get<{ g: number }>(
            `SELECT coalesce((SELECT gel_per_unit FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1),
            (SELECT gel_per_unit FROM fx_rates WHERE currency = ? ORDER BY date LIMIT 1)) AS g`,
            [r.currency, day, r.currency],
          )
        )?.g;
        if (!rate) continue;
        const lari = r.limit_minor * rate;
        const whole = Math.round(lari / 100) * 100;
        if (whole > 0 && Math.abs(lari - whole) <= 2) {
          await db.run("UPDATE plan_items SET currency = 'GEL', limit_minor = ? WHERE ym = ? AND category_id = ?", [
            whole,
            r.ym,
            r.category_id,
          ]);
        }
      }
    },
  ],
  // 54: a category's own regular payment isn't matched with operations any more: "Это оплата?" answers gone
  ['DROP TABLE IF EXISTS payment_answers'],
  // 55: a regular payment within the month is always carried over, "Дата окончания" its end: one saved not repeated
  // ends with its month
  [
    `UPDATE plan_items SET pinned = 1, until = CASE WHEN until IS NOT NULL AND until < date(ym || '-01', '+1 month', '-1 day')
        THEN until ELSE date(ym || '-01', '+1 month', '-1 day') END
      WHERE kind = 'fixed' AND every IS NOT NULL AND pinned = 0`,
  ],
  // 56: a new plan item starts in the app's currency (Настройки → Валюта), not the budget's: the current and coming months'
  // items without an amount yet (but funds — in the budget's) take it
  [
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await db.run(
        `UPDATE plan_items SET currency = coalesce((SELECT CASE WHEN value IN ('USD', 'EUR') THEN value END FROM app_settings WHERE key = 'display_currency'), 'GEL')
          WHERE limit_minor = 0 AND kind <> 'fund' AND ym >= ?`,
        [ym],
      );
    },
  ],
  // 57: "Остаток" answers the close by the account at the month's end (the budget's currency), not by "За месяц".
  // balance_open_minor is "В августе было" when the month before has no balance of its own
  [
    'ALTER TABLE month_closes ADD COLUMN by_balance INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE month_closes ADD COLUMN balance_minor INTEGER',
    'ALTER TABLE month_closes ADD COLUMN balance_open_minor INTEGER',
  ],
  // 58: a merchant of different categories keeps that list in an order. The first (position 0) is its primary
  // category: a new operation gets it, and the notification still asks. Lists already saved keep the order they
  // were shown in (the most used first).
  [
    'ALTER TABLE merchant_categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0',
    async (db) => {
      const rows = await db.all<{ merchant_key: string; category_id: number }>(
        `SELECT mc.merchant_key, mc.category_id
          FROM merchant_categories mc JOIN categories c ON c.id = mc.category_id
          ORDER BY mc.merchant_key,
            (SELECT count(*) FROM transactions t WHERE t.merchant_key = mc.merchant_key AND t.category_id = mc.category_id
              AND t.kind IN ('purchase', 'payment')) DESC,
            c.sort_order, c.id`,
      );
      let prev = '';
      let pos = 0;
      for (const r of rows) {
        if (r.merchant_key !== prev) {
          prev = r.merchant_key;
          pos = 0;
        }
        await db.run('UPDATE merchant_categories SET position = ? WHERE merchant_key = ? AND category_id = ?', [
          pos++,
          r.merchant_key,
          r.category_id,
        ]);
      }
    },
  ],
];
