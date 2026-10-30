// «Сбережения» of the month stats: what goes to savings, part by part, against the plan. This month — what goes if the
// rest is spent by plan (the overspend takes 💰, then 🔒, then the funds' contributions, the farthest due first, then the
// savings from before); a month over — what its "Итоги" laid out. No React.
import type { SavingsPlanFact } from '@/db/reportSavings';
import type { PlanView } from '../../plan/model/planView';
import { RING_FUNDS, RING_LOCKED, RING_SAVINGS } from '../../plan/parts/palette';

/** `info`: ⓘ — what took it ("Сбережения меньше на …") */
export type SavingsStatus = { text: string; tone: 'ok' | 'warn' | 'muted'; info?: boolean };
/**
 * a part: as planned and as it goes; `now` null — not known yet ("Итоги" not done). `fund`: a fund's, its progress after
 * the status ("взнос в копилку · 589 из 10 000 ₾ · к …")
 */
export type SavingsPart = {
  key: string; name: string; color: string; plan: number; now: number | null; status: SavingsStatus;
  fund?: { saved: number; target: number; due: string; currency: string };
};
export type SavingsSection = {
  parts: SavingsPart[];
  plan: number;
  now: number | null;
  /** what none of them covers: off the savings from before (ⓘ) */
  past: number;
  caption: string | null;
  /** "Итоги" not done: "Подвести итоги ›" opens them */
  closeYm: string | null;
};

type Money = (minor: number) => string;

const took = (n: number, money: Money, hidden: boolean, then = ''): SavingsStatus =>
  ({ text: `${hidden ? 'Перерасход взял часть' : `Перерасход взял ${money(n)}`}${then}`, tone: 'warn', info: true });

/** This month, from the plan's view. null — no budget, or nothing goes to savings. */
export function currentSavings(p: PlanView, money: Money, hidden: boolean): SavingsSection | null {
  if (!p.shownBudget || p.savingsPlanned <= 0) return null;
  const less = p.less;
  const parts: SavingsPart[] = [];
  if (p.locked > 0) {
    const now = less ? less.locked.now : p.locked;
    parts.push({
      key: 'locked', name: '🔒 Отложено сразу', color: RING_LOCKED, plan: p.locked, now,
      status: now < p.locked ? took(p.locked - now, money, hidden) : { text: '✓ отложено в начале месяца', tone: 'muted' },
    });
  }
  for (const f of p.funds) {
    const plan = f.converted_minor ?? 0;
    if (plan <= 0) continue;
    const cut = less?.funds.cut.get(f.category_id) ?? 0;
    parts.push({
      key: `fund-${f.category_id}`, name: `${f.emoji || ''} ${f.name}`.trim(), color: RING_FUNDS, plan, now: plan - cut,
      status: cut > 0 ? took(cut, money, hidden, ' — следующие взносы станут больше') : { text: 'взнос в копилку', tone: 'muted' },
      ...(f.fund && !cut && !hidden ? { fund: { saved: f.fund.saved_minor, target: f.fund.target_minor, due: f.fund.due, currency: f.currency } } : {}),
    });
  }
  for (const s of p.saving) {
    const plan = s.subs?.saving_minor ?? 0;
    parts.push({ key: `saving-${s.category_id}`, name: `${s.emoji || ''} ${s.name}`.trim(), color: RING_FUNDS, plan, now: plan, status: { text: 'копим на платежи', tone: 'muted' } });
  }
  const free = Math.max(0, p.free ?? 0);
  if (free > 0) {
    const now = less ? less.free.now : free;
    parts.push({
      key: 'floating', name: '💰 Сэкономлено', color: RING_SAVINGS, plan: free, now,
      status: now < free ? took(free - now, money, hidden) : { text: 'не запланировано — решите в итогах месяца', tone: 'muted' },
    });
  }
  const plan = parts.reduce((a, x) => a + x.plan, 0);
  return {
    parts, plan, now: parts.reduce((a, x) => a + (x.now ?? 0), 0), past: less?.past ?? 0,
    caption: 'К концу месяца, если дальше тратить по плану', closeYm: null,
  };
}

/** A month over, from what its "Итоги" laid out. null — nothing to show. */
export function pastSavings(f: SavingsPlanFact | null, ym: string, money: Money, hidden: boolean): SavingsSection | null {
  if (!f || f.plan <= 0) return null;
  const status = (plan: number, fact: number | null): SavingsStatus => (fact === null
    ? { text: 'итоги не подведены', tone: 'muted' }
    : fact < plan ? { text: hidden ? 'отложено меньше плана' : `отложено меньше на ${money(plan - fact)}`, tone: 'warn' }
      : { text: '✓ отложено', tone: 'ok' });
  const parts: SavingsPart[] = [];
  if (f.locked) parts.push({ key: 'locked', name: '🔒 Отложено сразу', color: RING_LOCKED, plan: f.locked.plan, now: f.locked.fact, status: status(f.locked.plan, f.locked.fact) });
  for (const x of f.funds) {
    parts.push({ key: `fund-${x.category_id}`, name: `${x.emoji || ''} ${x.name}`.trim(), color: RING_FUNDS, plan: x.plan, now: x.fact, status: status(x.plan, x.fact) });
  }
  // the leftover moved to the next month (or kept as is) isn't savings
  if (f.rest && (f.rest.choice === null || f.rest.choice === 'savings')) {
    parts.push({ key: 'floating', name: '💰 Сэкономлено', color: RING_SAVINGS, plan: f.rest.plan, now: f.rest.fact, status: status(f.rest.plan, f.rest.fact) });
  }
  return { parts, plan: f.plan, now: f.fact, past: 0, caption: null, closeYm: f.closed ? null : ym };
}
