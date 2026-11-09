// The current month's savings, less what the overspend already took: every category past its plan, and spending outside
// the plan past its share, comes out of what the plan leaves (💰 "Сэкономлено"), then out of 🔒 "Отложено сразу", then
// out of the funds' contributions (the farthest due first), then out of the savings from before. No React.
import type { PlanItem } from '@/db/plans';
import type { SpentBy } from './usePlanData';

/** a category past its plan (or the spending outside the plan past its share: `category_id` null) */
export type Overspent = { key: string; category_id: number | null; name: string; emoji: string | null; plan: number; spent: number; over: number };
/**
 * a limit with something left of it, for "Покрыть из плана": `left` of its `plan`; `take` — what covering the spending
 * outside the plan takes of it (the cut itself is counted in its own currency: coverFromLimit)
 */
export type CoverRoom = { category_id: number; name: string; emoji: string | null; left: number; take: number; plan: number };

export type SavingsLess = {
  /** savings as planned, and as they'll be if the rest is spent by plan */
  was: number;
  now: number;
  less: number;
  /** 💰 and 🔒, as planned and now */
  free: { was: number; now: number };
  locked: { was: number; now: number };
  /** what it took of the funds' contributions, by fund */
  funds: { less: number; cut: Map<number, number> };
  /** what none of them covers: off the savings from before */
  past: number;
  /** the biggest first */
  overs: Overspent[];
  /** the spending outside the plan past its share: what is left of the limits to cover it, the most left first */
  rooms: CoverRoom[];
};

/** less than this (a unit): noise of rates, not worth a word */
const NOISE = 100;

/** a fund's contribution this month */
type FundPart = { category_id: number; value: number; due: string };

type Input = {
  items: PlanItem[]; spentBy: SpentBy; unplanned: number; unplannedSpent: number; free: number; locked: number; funds: FundPart[];
};

/** null: the overspend took nothing (or less than a unit). */
export function savingsLess({ items, spentBy, unplanned, unplannedSpent, free, locked, funds }: Input): SavingsLess | null {
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
  let left = less - fromFree - fromLocked;
  const cut = new Map<number, number>();
  for (const f of [...funds].sort((a, b) => b.due.localeCompare(a.due))) {
    const take = Math.min(Math.max(0, f.value), left);
    if (take > 0) cut.set(f.category_id, take);
    left -= take;
  }
  return {
    was: wasFree + locked, now: wasFree + locked - fromFree - fromLocked, less,
    free: { was: wasFree, now: wasFree - fromFree }, locked: { was: locked, now: locked - fromLocked },
    funds: { less: less - fromFree - fromLocked - left, cut }, past: left,
    overs: overs.sort((a, b) => b.over - a.over),
    rooms: coverRooms(items, spentBy, Math.max(0, unplannedSpent - unplanned)),
  };
}

/** The limits with at least a unit left, the most left first. */
export function coverRooms(items: PlanItem[], spentBy: SpentBy, over: number): CoverRoom[] {
  if (over < NOISE) return [];
  return items.filter((i) => i.kind === 'limit' && (i.converted_minor ?? 0) > 0).map((i) => {
    const plan = i.converted_minor!;
    const left = plan - Math.max(0, spentBy.byCategory.get(i.category_id) ?? 0);
    return { category_id: i.category_id, name: i.name, emoji: i.emoji, left, take: Math.min(left, over), plan };
  }).filter((r) => r.left >= NOISE).sort((a, b) => b.left - a.left);
}

/** what the overspend takes beyond 💰: off 🔒, the funds' contributions and the savings from before */
export const lessTaken = (l: SavingsLess) => l.locked.was - l.locked.now + l.funds.less + l.past;

/** the sheet's lines, part by part: "🔒 отложено 0 ₾ из 500 ₾", "из прошлых сбережений уйдёт 150 ₾" */
export function lessLines(l: SavingsLess, money: (minor: number) => string): string[] {
  return [
    l.free.was > 0 ? `💰 сэкономлено ${money(l.free.now)} из ${money(l.free.was)}` : null,
    l.locked.was > 0 ? `🔒 отложено ${money(l.locked.now)} из ${money(l.locked.was)}` : null,
    l.funds.less > 0 ? `в копилки — на ${money(l.funds.less)} меньше` : null,
    l.past > 0 ? `из прошлых сбережений уйдёт ${money(l.past)}` : null,
  ].filter((x): x is string => x !== null);
}
