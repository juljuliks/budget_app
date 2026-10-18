// The current month's savings, less what the overspend already took: every category past its plan, and spending outside
// the plan past its share, comes out of what the plan leaves (💰 "Сэкономлено"), then out of 🔒 "Отложено сразу". No React.
import type { PlanItem } from '@/db/plans';
import type { SpentBy } from './usePlanData';

/** a category past its plan (or the spending outside the plan past its share: `category_id` null) */
export type Overspent = { key: string; category_id: number | null; name: string; emoji: string | null; plan: number; spent: number; over: number };

export type SavingsLess = {
  /** savings as planned, and as they'll be if the rest is spent by plan */
  was: number;
  now: number;
  less: number;
  /** 💰 and 🔒, as planned and now */
  free: { was: number; now: number };
  locked: { was: number; now: number };
  /** the biggest first */
  overs: Overspent[];
};

/** less than this (a unit): noise of rates, not worth a word */
const NOISE = 100;

type Input = { items: PlanItem[]; spentBy: SpentBy; unplanned: number; unplannedSpent: number; free: number; locked: number };

/** null: the overspend took nothing (or less than a unit). */
export function savingsLess({ items, spentBy, unplanned, unplannedSpent, free, locked }: Input): SavingsLess | null {
  const overs: Overspent[] = items.map((i) => {
    const plan = i.converted_minor ?? 0;
    const spent = spentBy.byCategory.get(i.category_id) ?? 0;
    return { key: String(i.category_id), category_id: i.category_id, name: i.name, emoji: i.emoji, plan, spent, over: spent - plan };
  }).filter((o) => o.over > 0);
  if (unplannedSpent > unplanned) {
    overs.push({ key: 'unplanned', category_id: null, name: 'Траты вне плана', emoji: '🎲', plan: unplanned, spent: unplannedSpent, over: unplannedSpent - unplanned });
  }
  const less = overs.reduce((a, o) => a + o.over, 0);
  if (less < NOISE) return null;
  const wasFree = Math.max(0, free);
  const fromFree = Math.min(wasFree, less);
  const fromLocked = Math.min(locked, less - fromFree);
  return {
    was: wasFree + locked, now: wasFree + locked - fromFree - fromLocked, less,
    free: { was: wasFree, now: wasFree - fromFree }, locked: { was: locked, now: locked - fromLocked },
    overs: overs.sort((a, b) => b.over - a.over),
  };
}
