// The report's savings and funds of a month over, planned and put aside: what its "Итоги месяца" laid out of what was
// put aside — each fund, 🔒 "Отложено сразу", 💰 "Сэкономлено". Not closed yet: the plan alone.
import { Currency } from './fx';
import { currentYm, monthClose, planConverter, RestChoice } from './plans';

export type PlanFact = { plan: number; fact: number | null };

export type SavingsPlanFact = {
  /** its "Итоги" are done (and say what was put aside): the facts are there */
  closed: boolean;
  /** 🔒 "Отложено сразу"; null — none */
  locked: PlanFact | null;
  /** 💰 "Сэкономлено": where it went (null — not closed); a fact only when it went to savings */
  rest: (PlanFact & { choice: RestChoice | null }) | null;
  funds: Array<{ category_id: number; name: string; emoji: string | null } & PlanFact>;
  /** what goes to savings and the funds (the leftover moved or kept as is isn't), planned and put aside */
  plan: number;
  fact: number | null;
  /** the funds' contributions as planned */
  fundsPlanned: number;
};

/** null: the month isn't over, or had neither a budget nor a fund. In `currency`. */
export async function savingsPlanFact(ym: string, currency: Currency, nowYm = currentYm()): Promise<SavingsPlanFact | null> {
  if (ym >= nowYm) return null;
  const c = await monthClose(ym, nowYm);
  if (!c.budget && !c.funds.length) return null;
  const conv = await planConverter(ym);
  const to = (minor: number, from: string) => conv(minor, from, currency) ?? minor;
  const b = c.budget;
  // closed by the migration (before "Итоги"): nothing was said about what was put aside
  const closed = c.closed && (c.ask_minor <= 0 || c.put_minor !== null);
  const choice = c.closed ? c.answers.rest_choice : null;
  // "Сколько удалось отложить?" laid out: the funds, 🔒, 💰
  const lockedFact = c.split?.locked ?? 0;
  const locked = b && b.locked_minor > 0 ? { plan: to(b.locked_minor, b.currency), fact: closed ? to(lockedFact, b.currency) : null } : null;
  const rest = b && b.rest_minor > 0 ? {
    plan: to(b.rest_minor, b.currency), choice,
    // "Оставить как есть" (no longer asked) of a month closed before: not savings
    fact: closed && choice === 'savings' ? to(c.split?.rest ?? 0, b.currency) : null,
  } : null;
  const funds = c.funds.map((f) => ({
    category_id: f.category_id, name: f.name, emoji: f.emoji, plan: to(f.planned_minor, f.currency),
    fact: closed && f.confirmed_minor !== null ? to(f.confirmed_minor, f.currency) : null,
  }));
  const restIn = rest && (choice === null || choice === 'savings');
  const plan = (locked?.plan ?? 0) + (restIn ? rest!.plan : 0) + funds.reduce((a, f) => a + f.plan, 0);
  const fact = !closed ? null : (locked?.fact ?? 0) + (restIn ? rest!.fact ?? 0 : 0) + funds.reduce((a, f) => a + (f.fact ?? 0), 0);
  return { closed, locked, rest, funds, plan, fact, fundsPlanned: funds.reduce((a, f) => a + f.plan, 0) };
}
