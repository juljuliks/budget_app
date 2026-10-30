import { lessLines, lessTaken, savingsLess } from '../../src/screens/stats/plan/model/savingsLess';
import type { PlanItem } from '../../src/db/plans';

const money = (minor: number) => `${minor / 100} ₾`;
const item = (category_id: number, plan: number) => ({ category_id, name: `c${category_id}`, emoji: null, converted_minor: plan } as PlanItem);
/** one category 500 ₾ in the plan, `spent` on it */
const less = (spent: number, o: { free?: number; locked?: number; funds?: Array<{ category_id: number; value: number; due: string }> } = {}) => savingsLess({
  items: [item(1, 50000)], spentBy: { byCategory: new Map([[1, spent]]), total: spent },
  unplanned: 0, unplannedSpent: 0, free: o.free ?? 0, locked: o.locked ?? 0, funds: o.funds ?? [],
})!;

describe('«Сбережения меньше на …»: part by part', () => {
  test('💰 first, then 🔒: only what is past 💰 is taken', () => {
    const l = less(80000, { free: 10000, locked: 30000 });
    expect(lessTaken(l)).toBe(20000);
    expect(lessLines(l, money)).toEqual(['💰 сэкономлено 0 ₾ из 100 ₾', '🔒 отложено 100 ₾ из 300 ₾']);
  });
  test('within 💰: nothing taken', () => {
    expect(lessTaken(less(55000, { free: 10000, locked: 30000 }))).toBe(0);
  });
  test('past 🔒: the funds\' contributions, the farthest due first, then the savings from before', () => {
    const l = less(110000, { locked: 30000, funds: [{ category_id: 7, value: 10000, due: '2027-01' }, { category_id: 8, value: 10000, due: '2027-06' }] });
    expect(l.funds.cut).toEqual(new Map([[8, 10000], [7, 10000]]));
    expect(lessTaken(l)).toBe(60000);
    expect(lessLines(l, money)).toEqual(['🔒 отложено 0 ₾ из 300 ₾', 'в копилки — на 200 ₾ меньше', 'из прошлых сбережений уйдёт 100 ₾']);
  });
  test('without 🔒: straight off the savings from before', () => {
    const l = less(65000);
    expect(lessLines(l, money)).toEqual(['из прошлых сбережений уйдёт 150 ₾']);
  });
});
