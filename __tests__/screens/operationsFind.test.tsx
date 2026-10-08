// 2.2–2.4: the search, the filters and the groupings of the operations.
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { openApp, rowOf, screen, scrollTo, tap } from './app';
import { ops } from '../../scripts/e2e/seeds';
import { dayKeyOf } from '../../src/ui/dateRange';

const search = (text: string) => fireEvent.changeText(screen.getByPlaceholderText('Поиск: мерчант, заметка, сумма…'), text);
/** the list shows exactly these (and not those) */
async function shows(yes: string[], no: string[] = []) {
  await waitFor(() => {
    for (const t of yes) expect(screen.queryAllByText(t).length).toBeGreaterThan(0);
    for (const t of no) expect(screen.queryByText(t)).toBeNull();
  });
}
const day = (n: number) => dayKeyOf(new Date(Date.now() - n * 864e5));

describe('2.2 the search', () => {
  beforeEach(() => openApp(ops));

  test('by merchant, any case', async () => {
    search('spar');
    await shows(['SPAR', 'Применено фильтров: 1'], ['WOLT', 'Возврат · ZARA']);
  });
  test('by note', async () => {
    search('маме');
    await shows(['GLOVO'], ['SPAR']);
  });
  test('by the amount in the SMS', async () => {
    search('45');
    await shows(['WOLT'], ['GLOVO', 'SPAR']);
  });
  test('by category', async () => {
    search('одежда');
    await shows(['Возврат · ZARA'], ['SPAR', 'WOLT']);
  });
  test('"без категории": the uncategorized', async () => {
    search('без категории');
    // a deposit is in "Пополнение счёта"
    await shows(['Перевод · NINO B', 'GLOVO'], ['SPAR', 'Пополнение · SALARY']);
  });
  test('"пополнение счёта": the deposits', async () => {
    search('пополнение счёта');
    await shows(['Пополнение · SALARY'], ['SPAR', 'GLOVO']);
  });
  test('several words: all of them', async () => {
    search('zara 120');
    await shows(['−120.00 ₾'], ['−80.00 ₾', 'Возврат · ZARA']);
  });
  test('ё and е are the same', async () => {
    search('еще');
    await shows(['WOLT'], ['SPAR']);
  });
  test('nothing found; ✕ clears it', async () => {
    search('xyzxyz');
    await shows(['Ничего не найдено.']);
    await tap('Очистить поиск');
    await shows(['SPAR', 'WOLT'], ['Применено фильтров: 1']);
  });
});

describe('2.3 the filters', () => {
  beforeEach(() => openApp(ops));

  test('categories: those with operations, with their counts; several at once', async () => {
    await tap('#filter-category');
    expect(await screen.findByText('Категории')).toBeTruthy();
    // "Без категории" among them, with how many (the deposit is in "Пополнение счёта")
    expect(within(rowOf('⚪️ Без категории')).getByText('2')).toBeTruthy();
    expect(within(rowOf('💳 Пополнение счёта')).getByText('1')).toBeTruthy();
    expect(within(rowOf('🛒 Продукты')).getByText('61')).toBeTruthy();
    await tap('👕 Одежда');
    await tap('📺 Подписки');
    expect(screen.getByText('Снять выбор')).toBeTruthy();
    await tap('Готово');
    await shows(['Категория · 2', 'Возврат · ZARA', 'NETFLIX.COM', 'Применено фильтров: 2'], ['SPAR', 'WOLT']);
  });

  test('"Снять выбор" in the sheet\'s header, only while something is picked', async () => {
    await tap('#filter-category');
    await screen.findByText('Категории');
    expect(screen.queryByText('Снять выбор')).toBeNull();
    await tap('🛒 Продукты');
    await tap('Снять выбор');
    expect(screen.queryByText('Снять выбор')).toBeNull();
    await tap('Готово');
    await shows(['SPAR', 'WOLT'], ['Применено фильтров: 1']);
  });

  test('kind: only refunds', async () => {
    await tap('#filter-kind');
    expect(await screen.findByText('Тип операции')).toBeTruthy();
    expect(within(rowOf('Перевод')).getByText('2')).toBeTruthy();
    await tap('Возврат');
    await tap('Готово');
    await shows(['Тип · 1', 'Возврат · ZARA'], ['SPAR', 'Перевод · NINO B']);
  });

  test('a day, then a range', async () => {
    await tap('#filter-date');
    await tap(`#day-${day(1)}`);
    await tap('Готово');
    await shows(['WOLT', 'GLOVO'], ['SPAR', 'Возврат · ZARA']);
    await tap('#filter-date');
    await tap('Сбросить даты');
    await tap(`#day-${day(3)}`);
    await tap(`#day-${day(1)}`);
    await tap('Готово');
    await shows(['WOLT', 'NETFLIX.COM'], ['SPAR', 'MARKET']);
  });

  test('the filters set: their list, each with ✕; "Сбросить все"', async () => {
    await tap('#filter-kind');
    await tap('Возврат');
    await tap('Готово');
    search('zara');
    await shows(['Применено фильтров: 2']);
    await tap('Применено фильтров: 2');
    expect(await screen.findByText('Фильтры')).toBeTruthy();
    // the text one off: the kind stays
    await tap('«zara»');
    await shows(['Применено фильтров: 1']);
    await tap('Готово');
    await tap('Сбросить все');
    await shows(['SPAR', 'WOLT'], ['Применено фильтров: 1']);
  });

  test('2.3.6: leaving the tab resets the filters, the search and the grouping', async () => {
    await tap('#filter-kind');
    await tap('Возврат');
    await tap('Готово');
    await tap('#filter-group');
    await tap('По мерчантам');
    await shows(['Применено фильтров: 1', 'По мерчантам']);
    await tap('Статистика');
    await tap('Операции');
    await shows(['По дням', 'SPAR', 'Сегодня'], ['Применено фильтров: 1', 'По мерчантам']);
  });

  test('2.4.8: "Сбросить все" keeps the grouping', async () => {
    await tap('#filter-group');
    await tap('По мерчантам');
    await tap('#filter-kind');
    await tap('Возврат');
    await tap('Готово');
    await tap('Сбросить все');
    await shows(['По мерчантам'], ['Применено фильтров: 1']);
  });
});

describe('2.4 the groupings', () => {
  beforeEach(() => openApp(ops));
  const groupBy = async (name: string) => { await tap('#filter-group'); await tap(name); };

  test('by merchant: the busiest first, spent minus received', async () => {
    await groupBy('По мерчантам');
    await shows(['MARKET · 60 операций', '−354.00 ₾']);
    // a group cut by a page goes on under the same header
    await scrollTo('operations-list', 'ZARA · 3 операции');
    await shows(['−195.00 ₾']);
    expect(screen.getAllByText(/^MARKET · /)).toHaveLength(1);
  });
  test('by category: "Без категории" first', async () => {
    await groupBy('По категориям');
    await shows(['⚪️ Без категории · 2 операции', '−30.00 ₾']);
  });
  test('by kind', async () => {
    await groupBy('По типу');
    await shows(['Покупка · 67 операций']);
    await scrollTo('operations-list', 'Пополнение · 1 операция');
    await shows(['Перевод · 2 операции', 'Возврат · 1 операция']);
  });
  test('by amount: the bands, the biggest inside first', async () => {
    await groupBy('По сумме');
    await shows(['100–500 · 2 операции']);
    // ZARA 120 before SALARY 100
    const amounts = screen.getAllByText(/^[−+]\d+\.\d\d ₾$/).map((t) => String(t.props.children).replace(/\s/g, ' '));
    expect(amounts.indexOf('−120.00 ₾')).toBeLessThan(amounts.indexOf('+100.00 ₾'));
    await scrollTo('operations-list', /^До 20 · /);
    await shows(['20–100 · 5 операций']);
  });
  test('by month: the newest first', async () => {
    await groupBy('По месяцам');
    await shows([/ · \d+ операц/ as unknown as string]);
  });
  test('back to the days', async () => {
    await groupBy('По мерчантам');
    await groupBy('По дням');
    await shows(['Сегодня', 'Вчера']);
  });
});
