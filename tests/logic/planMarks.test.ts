// How plan rows are going (screens/stats/plan/model/marks) and the stats' «Сбережения» (screens/stats/month/model/
// savingsSection): this month's parts as they go, the overspend's order, a month over by its "Итоги".
import { itemMark, savingsMark, shareMark } from '../../src/screens/stats/plan/model/marks';
import { planView } from '../../src/screens/stats/plan/model/planView';
import { currentSavings, pastSavings } from '../../src/screens/stats/month/model/savingsSection';
import { currentYm } from '../../src/db/plans';
import type { PlanBudget, PlanItem } from '../../src/db/plans';

const money = (minor: number) => `${minor / 100} ₾`;
const item = (p: Partial<PlanItem>): PlanItem => ({
  category_id: 1, name: 'Еда', emoji: '🛒', type_id: 1, type_name: 'Жизнь', limit_minor: 40000, currency: 'GEL',
  converted_minor: 40000, kind: 'limit', norm_period: 'week', pinned: false, previous_minor: null, until: null, every: null, weekdays: null, unit_minor: null, ...p,
});

test('a limit: spent; past it — by how much; a month over within it — "✓ уложились"; a coming month — none', () => {
  expect(itemMark('limit', 40000, 32000, 'current', money, false)).toEqual({ text: 'потрачено 320 ₾', tone: 'muted' });
  expect(itemMark('limit', 40000, 45000, 'current', money, false)).toEqual({ text: 'больше на 50 ₾', tone: 'warn' });
  expect(itemMark('limit', 40000, 30000, 'past', money, false)).toEqual({ text: '✓ уложились', tone: 'ok' });
  expect(itemMark('limit', 40000, 0, 'future', money, false)).toBeNull();
  expect(itemMark('limit', 0, 0, 'current', money, false)).toBeNull();
  // "Скрыть суммы": words and shares only
  expect(itemMark('limit', 40000, 10000, 'current', money, true)).toEqual({ text: 'потрачено 25%', tone: 'muted' });
});

test('a payment: paid, in part, not yet; paid more — both sums', () => {
  expect(itemMark('payment', 5000, 5000, 'current', money, false)).toEqual({ text: '✓ оплачено', tone: 'ok' });
  expect(itemMark('payment', 5000, 2000, 'current', money, false)).toEqual({ text: 'оплачено 20 ₾ из 50 ₾', tone: 'muted' });
  expect(itemMark('payment', 5000, 0, 'past', money, false)).toEqual({ text: 'не оплачено', tone: 'muted' });
  expect(itemMark('payment', 155754, 156282, 'current', money, false)).toEqual({ text: 'оплачено 1562.82 ₾ · больше на 5.28 ₾', tone: 'warn' });
});

test('savings: this month only — all of it goes, or what goes; the share outside the plan', () => {
  expect(savingsMark(14859, 14859, 'current', '✓ отложено', money, false)).toEqual({ text: '✓ отложено', tone: 'ok' });
  expect(savingsMark(926, 398, 'current', '✓ выходит', money, false)).toEqual({ text: 'выходит 3.98 ₾ — перерасход', tone: 'warn' });
  expect(savingsMark(926, 398, 'past', '✓ выходит', money, false)).toBeNull();
  expect(shareMark(30000, 38000, 'current', money, false)).toEqual({ text: 'больше доли на 80 ₾', tone: 'warn' });
  expect(shareMark(30000, 12000, 'current', money, false)).toEqual({ text: 'потрачено 120 ₾ из доли', tone: 'muted' });
});

test('«Сбережения» this month: 💰, 🔒, then the farthest fund, then the savings from before', () => {
  const b = { amount_minor: 100000, currency: 'GEL', unplanned_pct: 0, to_savings: false, locked_minor: 10000, unplanned_minor: null, carry: null } as PlanBudget;
  const fund = item({ category_id: 2, name: 'Отпуск', emoji: '🏖', kind: 'fund', converted_minor: 20000, limit_minor: 20000, fund: { target_minor: 300000, due: '2027-07-31', saved_minor: 0, start_minor: 0 } });
  // plan 600 + fund 200 + 🔒 100: 💰 100; spent 1 000 on the plan (400 over): 💰 100, 🔒 100, the fund 200
  const p = planView({
    ym: currentYm(), currency: 'GEL', items: [item({ converted_minor: 60000, limit_minor: 60000 }), fund], budget: b, toShown: (m) => m, fromShown: (m) => m,
    income: 0, unplannedSpentMinor: 0, spentBy: { byCategory: new Map([[1, 100000]]), total: 100000 }, hidden: false,
  });
  const s = currentSavings(p, money, false)!;
  expect(s.parts.map((x) => [x.name, x.plan, x.now, x.status.text])).toEqual([
    ['🔒 Отложено сразу', 10000, 0, 'Перерасход взял 100 ₾'],
    ['🏖 Отпуск', 20000, 0, 'Перерасход взял 200 ₾ — следующие взносы станут больше'],
    ['💰 Сэкономлено', 10000, 0, 'Перерасход взял 100 ₾'],
  ]);
  expect(s).toMatchObject({ plan: 40000, now: 0, past: 0, caption: 'К концу месяца, если дальше тратить по плану' });
});

test('«Сбережения» of a month over: what "Итоги" laid out; not done — "?", "Подвести итоги ›"; the leftover moved on — not in it', () => {
  const fact = {
    closed: true, locked: { plan: 30000, fact: 20000 }, rest: { plan: 10000, fact: 15000, choice: 'savings' as const },
    funds: [{ category_id: 2, name: 'Отпуск', emoji: '🏖', plan: 5000, fact: 5000 }], plan: 45000, fact: 40000, fundsPlanned: 5000,
  };
  const s = pastSavings(fact, '2026-09', money, false)!;
  expect(s.parts.map((x) => [x.name, x.now, x.status.text])).toEqual([
    ['🔒 Отложено сразу', 20000, 'отложено меньше на 100 ₾'], ['🏖 Отпуск', 5000, '✓ отложено'], ['💰 Сэкономлено', 15000, '✓ отложено'],
  ]);
  expect(s.closeYm).toBeNull();
  const open = pastSavings({ ...fact, closed: false, fact: null, locked: { plan: 30000, fact: null }, rest: { plan: 10000, fact: null, choice: 'next' } }, '2026-09', money, false)!;
  expect(open).toMatchObject({ now: null, closeYm: '2026-09' });
  expect(open.parts.map((x) => x.name)).toEqual(['🔒 Отложено сразу', '🏖 Отпуск']);
});
