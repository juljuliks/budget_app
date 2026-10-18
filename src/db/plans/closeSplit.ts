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

/** What the funds took of `total` as answered by hand: the rest is the savings', 🔒 first. */
export function savingsOf(total: number, fundsPart: number, locked: number): { locked: number; rest: number } {
  const savings = Math.max(0, total - fundsPart);
  const l = Math.min(Math.max(0, locked), savings);
  return { locked: l, rest: savings - l };
}
