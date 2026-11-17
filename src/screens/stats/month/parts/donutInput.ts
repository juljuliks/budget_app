// What the month's ring needs for its «План» view and its cut by sections: the planned sections and categories, the
// share outside the plan, the savings, the base of the shares (the budget, else the whole plan).
import type { StatGroup } from '@/db/plans';
import { colors } from '@/shared/theme/theme';
import type { SavingsSection } from '../model/savingsSection';
import type { SliceInput } from '../model/donutSlices';
import { groupId, SAVINGS_ID, UNPLANNED_ID } from './sections';

export function donutInput(groups: StatGroup[], unplanned: { share: number; spent: number }, savings: SavingsSection | null, base: number): SliceInput {
  return {
    // a section's color: its first category's (the shades of one section are alike)
    groups: groups.map((g) => ({ id: groupId(g), title: g.title, planned: g.planned_minor, spent: g.spent_minor, color: g.categories[0]?.color ?? null })),
    categories: groups.flatMap((g) => g.categories).map((c) => ({
      key: String(c.category_id), title: c.name, emoji: c.emoji, color: c.color, planned: c.limit_minor ?? 0, spent: c.spent_minor,
    })),
    unplanned: { id: UNPLANNED_ID, share: unplanned.share, spent: unplanned.spent, color: colors.faint },
    // in the budget's currency: its shares, as its header says them
    savings: savings?.budget && savings.plan > 0
      ? { id: SAVINGS_ID, share: savings.plan / savings.budget, done: (savings.now ?? 0) / savings.plan, color: colors.savingsText } : null,
    base,
  };
}
