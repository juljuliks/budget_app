// "Итоги месяца": a month over is closed with answers, step by step — what covers an overspend (spending past the budget
// less 🔒: "Из сбережений" takes 🔒, then the funds' contributions, then the savings from before), then "Сколько удалось отложить?": one sum, laid out over the funds' contributions, 🔒 and 💰 (closeSplit.ts;
// "Изменить распределение" — by hand: the funds' parts are fund_confirms). The leftover can go to the next month instead.
// What the answers send to the next month (an overspend owed, the leftover moved) is its carry. Answers are kept as
// given (a draft until closed); an unanswered question takes its default.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm, parseYm, ymOf } from './months';
import { planConverter, storedBudget } from './budget';
import { activeFunds, fundLedger } from './funds';
import { savingsOf, splitKept, splitSaved } from './closeSplit';
import { savingsBalance } from './closeBalance';
import type { CloseFund, CloseSplit, CloseStep, MonthClose, RestChoice } from './closeTypes';
import { budgetSide, closeAnswers, type CloseRow } from './closeBudget';

export * from './closeTypes';

const nextOf = (ym: string) => {
  const { year, month } = parseYm(ym);
  return ymOf(year, month + 1);
};

async function closeFunds(ym: string, nowYm: string): Promise<CloseFund[]> {
  const db = await getDb();
  const out: CloseFund[] = [];
  for (const fund of await activeFunds(ym)) {
    const planned =
      (
        await db.get<{ v: number }>(
          "SELECT limit_minor AS v FROM plan_items WHERE ym = ? AND category_id = ? AND kind = 'fund'",
          [ym, fund.category_id],
        )
      )?.v ?? 0;
    if (planned <= 0) continue;
    const confirmed = (
      await db.get<{ v: number }>('SELECT saved_minor AS v FROM fund_confirms WHERE ym = ? AND category_id = ?', [
        ym,
        fund.category_id,
      ])
    )?.v;
    const m = (await fundLedger(fund, ym, nowYm)).months.find((x) => x.ym === ym);
    const c = await db.get<{ name: string; emoji: string | null }>('SELECT name, emoji FROM categories WHERE id = ?', [
      fund.category_id,
    ]);
    out.push({
      category_id: fund.category_id,
      name: c?.name ?? '',
      emoji: c?.emoji ?? null,
      currency: fund.currency,
      target_minor: fund.target_minor,
      due: fund.due,
      planned_minor: planned,
      asked_minor: planned,
      confirmed_minor: confirmed ?? null,
      with_planned_minor: Math.max(0, (m?.end ?? 0) - (m?.contribution ?? 0) + planned),
    });
  }
  return out;
}

/** The leftover's choice of the last closed month: the default of the next one. */
async function lastRestChoice(ym: string): Promise<RestChoice | null> {
  const db = await getDb();
  return (
    (
      await db.get<{ r: RestChoice }>(
        'SELECT rest_choice AS r FROM month_closes WHERE ym < ? AND closed_at IS NOT NULL AND rest_choice IS NOT NULL ORDER BY ym DESC LIMIT 1',
        [ym],
      )
    )?.r ?? null
  );
}

/** The month's close: its steps, sums and answers. Asked of a month over (`ym` < `nowYm`). */
export async function monthClose(ym: string, nowYm = currentYm()): Promise<MonthClose> {
  const db = await getDb();
  const row = await db.get<CloseRow>(
    `SELECT over_cover, over_rest_cover, rest_choice, saved, saved_minor, by_balance, balance_minor, balance_open_minor, closed_at, locked_cover
       FROM month_closes WHERE ym = ?`,
    [ym],
  );
  const next_ym = nextOf(ym);
  const can_carry = next_ym >= nowYm;
  const funds = await closeFunds(ym, nowYm);
  const stored = await storedBudget(ym);
  const answers = closeAnswers(row, can_carry, row?.rest_choice ?? (await lastRestChoice(ym)));
  const currency = stored?.currency ?? funds[0]?.currency ?? 'GEL';
  const conv = await planConverter(ym);
  const inCur = (minor: number, from: Currency) => conv(minor, from, currency) ?? 0;
  // the funds' contributions as planned, the nearest due first: what the month set aside for them (the answer lays out
  // what went in); less what an overspend takes of them
  const order = [...funds].sort((a, b) => a.due.localeCompare(b.due));
  const amounts = order.map((f) => inCur(f.planned_minor, f.currency));
  const fundsPlanned = amounts.reduce((a, v) => a + v, 0);
  const { budget, payments, moved, carry } = await budgetSide({
    ym,
    row,
    stored,
    answers,
    can_carry,
    currency,
    conv,
    order,
    amounts,
    fundsPlanned,
  });
  const kept = budget?.kept_locked_minor ?? 0;
  const restPlanned = budget && answers.rest_choice === 'savings' ? budget.rest_minor : 0;
  const ask = amounts.reduce((a, v) => a + v, 0) + kept + restPlanned;
  // the account: what the month puts aside, less what the overspend took of the savings from before
  const past = budget?.from_past_minor ?? 0;
  const bal = await savingsBalance(ym, currency, conv, row ?? null, ask - past);
  const monthPut = !answers.saved
    ? null
    : answers.saved === 'yes'
      ? ask
      : answers.saved === 'no'
        ? 0
        : answers.saved_minor;
  const put = bal.balance.on ? (bal.put === null ? null : bal.put + past) : monthPut;
  // "Остаток" keeps the funds: a shortfall comes off 💰, then 🔒, then the farthest fund
  const autoOf = (total: number): CloseSplit => {
    const parts = bal.balance.on ? splitKept(total, amounts, kept, restPlanned) : splitSaved(total, amounts, kept);
    return {
      funds: order.map((f, i) => ({
        category_id: f.category_id,
        budget_minor: parts.funds[i],
        minor: conv(parts.funds[i], currency, f.currency) ?? parts.funds[i],
      })),
      locked: parts.locked,
      rest: parts.rest,
    };
  };
  const auto = put === null ? null : autoOf(put);
  let split = auto;
  if (put !== null) {
    if (funds.length && funds.every((f) => f.confirmed_minor !== null)) {
      const own = order.map((f) => ({
        category_id: f.category_id,
        minor: f.confirmed_minor!,
        budget_minor: inCur(f.confirmed_minor!, f.currency),
      }));
      split = {
        funds: own,
        ...savingsOf(
          put,
          own.reduce((a, f) => a + f.budget_minor, 0),
          kept,
        ),
      };
    }
  }
  const steps: CloseStep[] = [];
  if (payments.length) steps.push('payments');
  if (budget && budget.over_minor > 0) steps.push('over');
  if (ask > 0 || funds.length) steps.push('savings');
  const saved_minor = ask <= 0 || !split ? null : split.locked + split.rest;
  const overAnswered =
    !budget ||
    budget.over_minor === 0 ||
    (answers.over_cover !== null && (budget.over_rest_minor === 0 || answers.over_rest_cover !== null));
  const complete = overAnswered && (ask <= 0 || put !== null) && payments.every((p) => p.choice !== null);
  return {
    ym,
    next_ym,
    can_carry,
    closed: row?.closed_at != null,
    steps,
    funds,
    budget,
    answers,
    ask_minor: ask,
    currency,
    put_minor: put,
    balance: bal.balance,
    account_minor: ask - past,
    split,
    auto,
    planned: autoOf(ask),
    saved_minor,
    complete,
    carry,
    payments,
    moved_minor: moved,
  };
}

/**
 * The oldest month over that isn't closed and has something to ask (a plan with a budget or a fund's contribution).
 * Every one with nothing to ask is closed on the way. null — nothing to close.
 */
export async function monthToClose(nowYm = currentYm()): Promise<string | null> {
  const db = await getDb();
  const open = await db.all<{ ym: string }>(
    `SELECT ym FROM (SELECT ym FROM plan_months WHERE budget_minor IS NOT NULL UNION SELECT ym FROM plan_items WHERE limit_minor > 0)
      WHERE ym < ? AND ym NOT IN (SELECT ym FROM month_closes WHERE closed_at IS NOT NULL) ORDER BY ym`,
    [nowYm],
  );
  let first: string | null = null;
  for (const { ym } of open) {
    if ((await monthClose(ym, nowYm)).steps.length) {
      first ??= ym;
      continue;
    }
    await db.run(
      `INSERT INTO month_closes (ym, closed_at) VALUES (?, ?) ON CONFLICT(ym) DO UPDATE SET closed_at = excluded.closed_at`,
      [ym, Math.floor(Date.now() / 1000)],
    );
  }
  return first;
}
