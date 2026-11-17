// The month's ring in its «План» view: the budget split by the sections — each section's plan as a segment, "Вне
// плана" (its share), "Сбережения", what is free of the budget; and how much of each is spent. No React.

export type BudgetPiece = {
  /** the section's id, as its header's; 'free' — the budget not planned */
  key: string;
  title: string;
  color: string | null;
  /** its share of the budget, 0..1 */
  share: number;
  /** what is spent of its plan (put by, for the savings): 1 — all of it, over 1 — past it */
  done: number;
};

export type BudgetInput = {
  groups: Array<{ id: string; title: string; planned: number; spent: number; color: string | null }>;
  unplanned: { id: string; share: number; spent: number; color: string };
  /** «Сбережения»: in the budget's currency, maybe not the stats' — its plan's share of the budget and what is put by of it */
  savings: { id: string; share: number; done: number; color: string } | null;
  /** what the shares are of: the budget (else the whole plan) */
  base: number;
};

const done = (spent: number, plan: number) => (plan > 0 ? Math.max(spent / plan, 0) : 0);

/** The pieces, in the order of the sections on the screen; under two — none (nothing to split). */
export function budgetBySection({ groups, unplanned, savings, base }: BudgetInput): BudgetPiece[] {
  if (!(base > 0)) return [];
  const pieces: BudgetPiece[] = groups.filter((g) => g.planned > 0)
    .map((g) => ({ key: g.id, title: g.title, color: g.color, share: g.planned / base, done: done(g.spent, g.planned) }));
  if (unplanned.share > 0) {
    pieces.push({ key: unplanned.id, title: 'Вне плана', color: unplanned.color, share: unplanned.share / base, done: done(unplanned.spent, unplanned.share) });
  }
  if (savings && savings.share > 0) {
    pieces.push({ key: savings.id, title: 'Сбережения', color: savings.color, share: savings.share, done: Math.max(savings.done, 0) });
  }
  const taken = pieces.reduce((a, p) => a + p.share, 0);
  if (taken < 0.995) pieces.push({ key: 'free', title: 'Свободно', color: null, share: 1 - taken, done: 0 });
  return pieces.length > 1 ? pieces : [];
}
