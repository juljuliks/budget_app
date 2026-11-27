// The month's plan items as the plan shows them: amounts in its currency, the funds' progress, the payments.
import { getDb } from '../index';
import type {} from '../types';
import { Currency } from '../fx';
import { asCurrency, currentYm, parseYm, ymOf } from './months';
import { PlanItem, asNorm } from './types';
import type {} from './regularTimes';
import { activeFunds, contributionOf, fundLedger } from './funds';
import { monthPayments } from './recurringItems';
import type { RecurringPayment } from '../recurring/reads';
import { ensureMonthPlan, planConverter, planCurrency } from './budget';

/** The month's plan items; `converted_minor` in `to` (default: the amount to distribute's currency). */
export async function listPlan(ym: string, to?: Currency): Promise<PlanItem[]> {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const prev = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
  const rows = await db.all<
    Omit<PlanItem, 'pinned' | 'converted_minor' | 'currency'> & { pinned: number; currency: string }
  >(
    `SELECT p.category_id, c.name, c.emoji, c.system, c.recurring = 1 AS recurring, coalesce(c.system = 'subs', 0) AS by_merchant, c.type_id, ct.name AS type_name, p.limit_minor, p.currency, p.kind, p.norm_period, p.pinned,
        p.until, CASE WHEN p.kind = 'fixed' THEN p.every END AS every, p.weekdays, p.unit_minor,
        (SELECT q.limit_minor FROM plan_items q WHERE q.ym = ? AND q.category_id = p.category_id) AS previous_minor
      FROM plan_items p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE p.ym = ?
      ORDER BY ct.id IS NULL, ct.sort_order, ct.name, c.sort_order, c.name`,
    [prev?.ym ?? '', ym],
  );
  const target = to ?? (await planCurrency(ym));
  const conv = await planConverter(ym);
  const funds = await fundsOf(
    ym,
    rows.filter((r) => r.kind === 'fund').map((r) => r.category_id),
  );
  // a category with repeating payments: their names, those saved up for, the contributions
  const subsInfo = new Map<number, NonNullable<PlanItem['subs']>>();
  // a subscriptions item recounted from its charges (a done one at the charge day's rate); a past month keeps what it stored
  const liveTotal = new Map<number, number>();
  for (const r of rows.filter((x) => x.recurring)) {
    const subs = await monthPayments(ym, target, undefined, r.category_id);
    if (r.kind === 'subs' && ym >= currentYm()) {
      liveTotal.set(r.category_id, subs.total_minor);
      // stored in this currency already: bring it to the recounted sum, so the next look and the budget agree
      if (asCurrency(r.currency) === target && r.limit_minor !== subs.total_minor) {
        await db.run('UPDATE plan_items SET limit_minor = ? WHERE ym = ? AND category_id = ?', [
          subs.total_minor,
          ym,
          r.category_id,
        ]);
      }
    }
    const savingIds = new Set(subs.saving.map((v) => v.payment_id));
    const subNames = (keep: (id: number) => boolean) =>
      [...subs.charges.map((c) => c.sub), ...subs.later.map((l) => l.sub)]
        .filter((s) => keep(s.id))
        .map((s) => s.name)
        .filter((n, i, all) => all.indexOf(n) === i);
    const all = [...subs.charges.map((c) => c.sub), ...subs.later.map((l) => l.sub), ...subs.undated].filter(
      (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
    );
    const only = all.length === 1 ? all[0] : null;
    // its charge this month: the first not paid yet (a weekly one has several), else the last paid
    const own = only ? subs.charges.filter((c) => c.sub.id === only.id) : [];
    const charge = own.find((c) => !c.done) ?? own[own.length - 1];
    // all its payments in one currency: the month's charges (but those paid from what was saved) and contributions in it
    const one = all.length && all.every((s) => s.currency === all[0].currency) ? all[0].currency : null;
    subsInfo.set(r.category_id, {
      names: subNames((id) => !savingIds.has(id)),
      saving_names: subNames((id) => savingIds.has(id)),
      saving_minor: subs.saving.reduce((a, v) => a + (v.converted_minor ?? 0), 0),
      ...savingProgress(subs.saving, all, (minor, from) => conv(minor, from, target) ?? 0),
      empty: all.length === 0,
      charges: { total: subs.charges.length, done: subs.charges.filter((c) => c.done).length },
      ...(one
        ? {
            in_currency: {
              currency: one,
              charges_minor: subs.charges.filter((c) => !c.saved).reduce((a, c) => a + c.sub.amount_minor, 0),
              saving_minor: subs.saving.reduce((a, v) => a + v.contribution_minor, 0),
            },
          }
        : {}),
      // none charged this month: the next charge, in a coming month ("30 ₾ в ноябре")
      ...(!subs.charges.length && subs.later[0] && subs.later[0].next.slice(0, 7) > ym
        ? {
            upcoming: {
              amount_minor: subs.later[0].sub.amount_minor,
              currency: subs.later[0].sub.currency,
              ym: subs.later[0].next.slice(0, 7),
            },
          }
        : {}),
      ...(only
        ? {
            single: {
              period: only.period,
              done: !!charge?.done,
              day: charge?.day ?? subs.later.find((l) => l.sub.id === only.id)?.next ?? null,
            },
          }
        : {}),
    });
  }
  return rows.map((r) => ({
    ...r,
    currency: asCurrency(r.currency),
    norm_period: asNorm(r.norm_period),
    converted_minor: liveTotal.get(r.category_id) ?? conv(r.limit_minor, asCurrency(r.currency), target),
    pinned: r.pinned === 1,
    previous_minor: r.previous_minor || null,
    ...(funds.has(r.category_id) ? { fund: funds.get(r.category_id) } : {}),
    recurring: !!r.recurring,
    by_merchant: !!r.by_merchant,
    ...(subsInfo.has(r.category_id) ? { subs: subsInfo.get(r.category_id) } : {}),
  }));
}

/** The payments saved up for: what they have by the month's end and their amounts, together in the plan's currency. */
function savingProgress(
  saving: Array<{ payment_id: number; end_minor: number }>,
  subs: RecurringPayment[],
  toTarget: (minor: number, from: Currency) => number,
) {
  let end = 0;
  let amount = 0;
  for (const v of saving) {
    const sub = subs.find((s) => s.id === v.payment_id);
    if (!sub) continue;
    end += toTarget(v.end_minor, sub.currency);
    amount += toTarget(sub.amount_minor, sub.currency);
  }
  return { saving_end_minor: end, saving_amount_minor: amount };
}

const ymAfter = (ym: string) => {
  const { year, month } = parseYm(ym);
  return ymOf(year, month + 1);
};

/** The funds among the month's items: how much by when, and what each has by the month's end. */
async function fundsOf(ym: string, ids: number[]): Promise<Map<number, NonNullable<PlanItem['fund']>>> {
  const out = new Map<number, NonNullable<PlanItem['fund']>>();
  if (!ids.length) return out;
  const db = await getDb();
  // what the budget fitted of each (fundFit.ts): none of the past months'
  const fits = new Map(
    (
      await db.all<{ id: number; cap: number | null; taken: number; c: string | null }>(
        `SELECT p.category_id AS id, p.cap_minor AS cap, p.taken_minor AS taken, pm.budget_currency AS c
      FROM plan_items p LEFT JOIN plan_months pm ON pm.ym = p.ym WHERE p.ym = ? AND p.kind = 'fund' AND p.ym >= ?`,
        [ym, currentYm()],
      )
    ).map((r) => [r.id, r]),
  );
  for (const fund of await activeFunds(ym)) {
    if (!ids.includes(fund.category_id)) continue;
    const m = (await fundLedger(fund, ym)).months.find((x) => x.ym === ym);
    const f = fits.get(fund.category_id);
    const asked = m ? contributionOf(fund, ym, m.start) : 0;
    const next = ymAfter(ym);
    const fit =
      f && m && (f.cap !== null || f.taken > 0)
        ? { asked, taken: f.taken, taken_currency: f.c, next: contributionOf(fund, next, m.end) }
        : null;
    out.set(fund.category_id, {
      target_minor: fund.target_minor,
      due: fund.due,
      saved_minor: m?.end ?? fund.start_minor,
      start_minor: fund.start_minor,
      fit,
    });
  }
  return out;
}
