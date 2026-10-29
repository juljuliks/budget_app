// "Итоги месяца": what was put aside ("Сколько удалось отложить?") laid out — the funds' contributions first, the nearest
// due first, then 🔒 "Отложено сразу" kept, then 💰 "Сэкономлено" (anything past the plan goes there too, the funds
// don't get more than their contribution). No database.

export type SavedSplit = { funds: number[]; locked: number; rest: number };

/** `total` over the funds (in their order, each up to its contribution), 🔒 up to `locked`, the rest to 💰. */
export function splitSaved(total: number, funds: number[], locked: number): SavedSplit {
  let left = Math.max(0, total);
  const out = funds.map((planned) => { const v = Math.min(Math.max(0, planned), left); left -= v; return v; });
  const l = Math.min(Math.max(0, locked), left);
  return { funds: out, locked: l, rest: left - l };
}

export type OverCoverParts = { locked: number; funds: number[]; past: number };

/**
 * "Из сбережений": an overspend comes off 🔒 first, then off the funds' contributions — the last of `funds` is the
 * farthest due, so it is cut first — and what is left of it off the savings from before.
 */
export function coverOver(over: number, locked: number, funds: number[]): OverCoverParts {
  let left = Math.max(0, over);
  const l = Math.min(Math.max(0, locked), left);
  left -= l;
  const out = funds.map(() => 0);
  for (let i = funds.length - 1; i >= 0 && left > 0; i--) {
    out[i] = Math.min(Math.max(0, funds[i]), left);
    left -= out[i];
  }
  return { locked: l, funds: out, past: left };
}

/** What the funds took of `total` as answered by hand: the rest is the savings', 🔒 first. */
export function savingsOf(total: number, fundsPart: number, locked: number): { locked: number; rest: number } {
  const savings = Math.max(0, total - fundsPart);
  const l = Math.min(Math.max(0, locked), savings);
  return { locked: l, rest: savings - l };
}

/**
 * "Остаток": `total` is how much the account changed (it may be negative). The plan stays when `total` covers it,
 * and anything past it goes to 💰. A shortfall comes off 💰, then 🔒, then the funds — the last of `funds` is the
 * farthest due, so it is cut first. Nothing of the split goes below 0 (a fall of the account is not a negative part).
 */
export function splitKept(total: number, funds: number[], locked: number, rest: number): SavedSplit {
  const plannedFunds = funds.map((n) => Math.max(0, n));
  const plannedLocked = Math.max(0, locked);
  const plannedRest = Math.max(0, rest);
  const plan = plannedFunds.reduce((a, n) => a + n, 0) + plannedLocked + plannedRest;
  if (total >= plan) return { funds: plannedFunds, locked: plannedLocked, rest: plannedRest + (total - plan) };
  let cut = plan - total;
  const restOut = Math.max(0, plannedRest - cut);
  cut = Math.max(0, cut - plannedRest);
  const lockedOut = Math.max(0, plannedLocked - cut);
  cut = Math.max(0, cut - plannedLocked);
  const out = [...plannedFunds];
  for (let i = out.length - 1; i >= 0 && cut > 0; i--) {
    const take = Math.min(out[i], cut);
    out[i] -= take;
    cut -= take;
  }
  return { funds: out, locked: lockedOut, rest: restOut };
}

export type BalanceView = {
  /** what the month adds to: the month before's balance, else the one typed for it */
  base: number | null;
  /** that plus what the budget would save — what the field opens on */
  suggested: number | null;
  /** the balance typed minus the base; null until both are known */
  delta: number | null;
  /** suggested minus the balance: above 0 — the account is short of the calculation */
  short: number | null;
};

/** The balance field against the month before and what the budget would save. */
export function balanceView(prior: number | null, open: number | null, value: number | null, ask: number): BalanceView {
  const base = prior ?? open;
  if (base === null) return { base, suggested: null, delta: null, short: null };
  const suggested = base + ask;
  if (value === null) return { base, suggested, delta: null, short: null };
  return { base, suggested, delta: value - base, short: suggested - value };
}
