// The month's ring cut four ways: «Траты» or «План», by categories or by sections. Spent by categories is the ring as
// it always was (MonthDonut); the other three are worked out here: a slice each, its amount in the stats' currency and
// how much of its plan is spent. No React.
import { budgetBySection, type BudgetInput } from './budgetBySection';

export type DonutView = 'spent' | 'plan';
export type DonutCut = 'category' | 'section';

export type Slice = {
  /** a section's id (its header's), a category's id; 'free' — the budget not planned */
  key: string;
  title: string;
  emoji?: string | null;
  color: string | null;
  /** in the stats' currency: what was spent («Траты») or planned («План») */
  value: number;
  /** «План»: what is spent of it (put by, for the savings), 1 — all */
  done?: number;
};

export type SliceInput = BudgetInput & {
  /** the planned categories by section */
  categories: Array<{ key: string; title: string; emoji: string | null; color: string; planned: number; spent: number }>;
};

/** «Траты» by sections: each section's spending, then outside the plan's. */
function spentBySection(i: SliceInput): Slice[] {
  return [
    ...i.groups.map((g) => ({ key: g.id, title: g.title, color: g.color, value: Math.max(g.spent, 0) })),
    { key: i.unplanned.id, title: 'Вне плана', color: i.unplanned.color, value: i.unplanned.spent },
  ].filter((s) => s.value > 0);
}

/** «План» by categories: each planned category's amount, the share outside the plan, the savings, what is free. */
function planByCategory(i: SliceInput): Slice[] {
  const rest = budgetBySection(i).filter((p) => !i.groups.some((g) => g.id === p.key));
  return [
    ...i.categories.filter((c) => c.planned > 0).map((c) => ({ key: c.key, title: c.title, emoji: c.emoji, color: c.color, value: c.planned, done: c.spent / c.planned })),
    ...rest.map((p) => ({ key: p.key, title: p.title, color: p.color, value: p.share * i.base, done: p.done })),
  ];
}

/** The slices of a view and cut (spent by categories — null: the ring's own). */
export function donutSlices(view: DonutView, cut: DonutCut, i: SliceInput): Slice[] | null {
  if (view === 'spent') return cut === 'category' ? null : spentBySection(i);
  if (cut === 'section') return budgetBySection(i).map((p) => ({ key: p.key, title: p.title, color: p.color, value: p.share * i.base, done: p.done }));
  return planByCategory(i);
}
