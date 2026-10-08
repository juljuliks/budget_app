// 4.5: deleting a category with operations this month — all to one category, sorted out to several, left halfway.
// The database checks: what moved, what the past keeps, where the merchants went.
import { waitFor } from '@testing-library/react-native';
import { openApp, openSettings, screen, tap } from './app';
import { base } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';

const q = async <T,>(sql: string, p: unknown[] = []) => (await getDb()).all<T>(sql, p as never);
const monthStart = new Date(2026, 9, 1).getTime() / 1000;
/** a merchant's operations this month or before it: [category, source] */
const ops = async (m: string, past: boolean) => (await q<{ c: string | null; s: string | null }>(
  `SELECT c.name AS c, t.category_source AS s FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.merchant_key = ? AND t.occurred_at ${past ? '<' : '>='} ? ORDER BY t.occurred_at`, [m, monthStart])).map((r) => [r.c, r.s]);
const ruleOf = async (m: string) => (await q<{ name: string }>(
  "SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.match_type = 'exact' AND r.pattern = ?", [m]))[0]?.name ?? null;
const deleted = async (name: string) => !!(await q<{ d: number | null }>('SELECT deleted_at AS d FROM categories WHERE name = ?', [name]))[0]?.d;

beforeEach(async () => {
  await openApp(base);
  await openSettings('Категории');
  await tap('🛍️ Покупки');
  await tap('Удалить категорию');
  expect(await screen.findByText(/^В этом месяце в «🛍️ Покупки» 4 операции на 360\.00 ₾\. Перед удалением их нужно перенести — в одну категорию или разложить по нескольким\.$/)).toBeTruthy();
});

test('all to one category: what moves and what stays, then moved and deleted', async () => {
  await tap('Перенести всё в одну категорию');
  await tap('👕 Одежда');
  await tap('Сохранить');
  expect(await screen.findByText('Перенести в «👕 Одежда» и удалить «🛍️ Покупки»?')).toBeTruthy();
  expect(screen.getByText([
    '• 4 операции на 360.00 ₾ этого месяца перейдут в «👕 Одежда».',
    '• 2 операции на 1 000.00 ₾ прошлых месяцев останутся в «🛍️ Покупки» — история и отчёты не изменятся.',
    '• 3 мерчанта (ZARA, APPLE, HM) получат категорию «👕 Одежда» — их новые операции будут попадать туда.',
    '• План «🛍️ Покупки» на этот месяц удалится.',
  ].join('\n'))).toBeTruthy();
  await tap('Перенести и удалить');
  expect(await screen.findByText('Категория «🛍️ Покупки» удалена')).toBeTruthy();
  expect(await deleted('Покупки')).toBe(true);
  expect((await ops('ZARA', false)).map((o) => o[0])).toEqual(['Одежда', 'Одежда']);
  // the past stays in it, fixed: the merchant moving on doesn't take it along
  expect(await ops('ZARA', true)).toEqual([['Покупки', 'user']]);
  expect(await ops('APPLE', true)).toEqual([['Покупки', 'user']]);
  expect([(await ops('HM', false))[0][0], (await ops('WOLT', false))[0][0]]).toEqual(['Одежда', 'Одежда']);
  expect([await ruleOf('ZARA'), await ruleOf('APPLE'), await ruleOf('HM')]).toEqual(['Одежда', 'Одежда', 'Одежда']);
  expect((await q<{ n: number }>("SELECT count(*) AS n FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Покупки'"))[0].n).toBe(0);
});

test('sorted out to several: a merchant with this month only, one operation alone, one to none; where they went; deleted', async () => {
  await tap('Разложить по разным категориям');
  expect(await screen.findByText('Удаление «🛍️ Покупки»: осталось 4 операции на 360.00 ₾')).toBeTruthy();
  expect(screen.getByText('По мерчантам')).toBeTruthy();
  expect(screen.getByText('ZARA · 2 операции')).toBeTruthy();
  // ZARA, the whole group, and the merchant too
  await tap('#group-checkbox-ZARA');
  await tap('#bulk-category');
  await tap('👕 Одежда');
  expect(await screen.findByText('Категория «👕 Одежда» — только для выбранных операций или и для мерчанта?')).toBeTruthy();
  expect(screen.getByText('Мерчант ZARA получит категорию «👕 Одежда» — его новые операции будут попадать туда. Прошлые месяцы останутся в «🛍️ Покупки».')).toBeTruthy();
  await tap('И для мерчанта');
  expect(await screen.findByText('Удаление «🛍️ Покупки»: осталось 2 операции на 110.00 ₾')).toBeTruthy();
  // HM: the operation only (one operation: no checkbox on its header, the row picks it)
  expect(screen.queryByTestId('group-checkbox-HM')).toBeNull();
  await tap('HM');
  await tap('#bulk-category');
  await tap('💻 Техника');
  await tap('Только для выбранных (1)');
  expect(await screen.findByText('Удаление «🛍️ Покупки»: осталась 1 операция на 30.00 ₾')).toBeTruthy();
  // WOLT: to none, nothing to ask
  await tap('WOLT');
  await tap('#bulk-category');
  await tap('⚪️ Без категории');
  expect(await screen.findByText('Все операции перенесены')).toBeTruthy();
  expect(screen.getByText([
    '4 операции на 360.00 ₾:',
    '• в «👕 Одежда» — 2 на 250.00 ₾',
    '• в «💻 Техника» — 1 на 80.00 ₾',
    '• без категории — 1 на 30.00 ₾',
    '',
    '2 операции на 1 000.00 ₾ прошлых месяцев останутся в «🛍️ Покупки» — история и отчёты не изменятся. 2 мерчанта (APPLE, HM) всё ещё с категорией «🛍️ Покупки» — после удаления останутся без категории. План «🛍️ Покупки» на этот месяц удалится.',
  ].join('\n'))).toBeTruthy();
  await tap('Удалить «🛍️ Покупки»');
  expect(await screen.findByText('Категория «🛍️ Покупки» удалена')).toBeTruthy();
  await waitFor(() => expect(screen.queryByTestId('sort-out-banner')).toBeNull());
  expect(await deleted('Покупки')).toBe(true);
  expect(await ops('ZARA', false)).toEqual([['Одежда', 'rule'], ['Одежда', 'rule']]);
  expect(await ops('ZARA', true)).toEqual([['Покупки', 'user']]);
  expect(await ruleOf('ZARA')).toBe('Одежда');
  expect((await ops('HM', false)).map((o) => o[0])).toEqual(['Техника']);
  expect(await ruleOf('HM')).toBeNull();
  expect((await ops('WOLT', false)).map((o) => o[0])).toEqual([null]);
  expect(await ops('APPLE', true)).toEqual([['Покупки', 'user']]);
});

test('left halfway: the category filter locked; "Отменить" and back ask; "Продолжить" stays, "Прервать" keeps the category and what moved', async () => {
  await tap('Разложить по разным категориям');
  await screen.findByTestId('sort-out-banner');
  expect(screen.getByTestId('filter-category').props.accessibilityState?.disabled).toBe(true);
  await tap('#group-checkbox-ZARA');
  await tap('#bulk-category');
  await tap('👕 Одежда');
  await tap('И для мерчанта');
  expect(await screen.findByText('Удаление «🛍️ Покупки»: осталось 2 операции на 110.00 ₾')).toBeTruthy();
  await tap('#sort-out-cancel');
  expect(await screen.findByText('Прервать удаление «🛍️ Покупки»?')).toBeTruthy();
  expect(screen.getByText('Категория «🛍️ Покупки» не удалится. Уже перенесённые операции останутся там, куда вы их перенесли.')).toBeTruthy();
  await tap('Продолжить');
  expect(screen.getByTestId('sort-out-banner')).toBeTruthy();
  await tap('Назад');
  expect(await screen.findByText('Прервать удаление «🛍️ Покупки»?')).toBeTruthy();
  await tap('Прервать');
  expect(await screen.findByText('Разделы')).toBeTruthy();
  expect(await deleted('Покупки')).toBe(false);
  expect((await ops('ZARA', false)).map((o) => o[0])).toEqual(['Одежда', 'Одежда']);
  expect(await ops('ZARA', true)).toEqual([['Покупки', 'user']]);
  expect((await ops('HM', false)).map((o) => o[0])).toEqual(['Покупки']);
});
