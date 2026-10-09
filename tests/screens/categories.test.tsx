// 4: the categories — the list, creating and changing one, the sections, merging, deleting.
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { navigationRef } from '../../src/shared/navigation/navigation';
import { longPress, openApp, openSettings, screen, tap, texts } from './app';
import { base, category, ops } from '../e2e/seeds';
import { setPlanAmount } from '../../src/db/plans';
import { getDb } from '../../src/db';

const q = async <T,>(sql: string, p: unknown[] = []) => (await getDb()).all<T>(sql, p as never);
const cat = async (name: string) => (await q<{ id: number; deleted_at: number | null; emoji: string | null; type_id: number | null }>(
  'SELECT id, deleted_at, emoji, type_id FROM categories WHERE name = ?', [name]))[0];

async function openCategories(seed = ops) {
  await openApp(seed);
  await openSettings('Категории');
  await screen.findByText('Разделы');
}

describe('4.1–4.2 the list; creating and changing a category', () => {
  beforeEach(() => openCategories());

  test('by section; "Разделы" on top', async () => {
    const all = texts();
    expect(all).toContain('Переводы');
    expect(all).toContain('Без раздела');
    expect(all).toContain('🛒 Продукты');
    expect(all.indexOf('Разделы')).toBeLessThan(all.indexOf('🛒 Продукты'));
  });

  test('a new one: the name required, the preview, created at the end of the list', async () => {
    await tap('Новая категория');
    expect(await screen.findByText('Новая категория')).toBeTruthy();
    await tap('Создать');
    expect(await screen.findByText(/Введите название$/)).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Например, Спорт'), 'Спорт');
    expect(screen.getByText('Будет выглядеть так: Спорт')).toBeTruthy();
    await tap('Выбрать эмодзи');
    await tap(/^⚽/);
    expect(await screen.findByText(/^Будет выглядеть так: ⚽️? Спорт$/)).toBeTruthy();
    await tap('Создать');
    expect(await screen.findByText(/^Категория «⚽️? Спорт» создана$/)).toBeTruthy();
    expect(await screen.findByText(/^⚽️? Спорт$/)).toBeTruthy();
    expect((await cat('Спорт')).emoji).toMatch(/^⚽/);
  });

  test('the same name in the same section: refused, any case', async () => {
    await tap('Новая категория');
    fireEvent.changeText(await screen.findByPlaceholderText('Например, Спорт'), 'продукты');
    await tap('Создать');
    expect(await screen.findByText(/Такая категория уже есть$/)).toBeTruthy();
  });

  test('changing one: its operations, then the new name everywhere', async () => {
    await tap('🛒 Продукты');
    expect(await screen.findByText('Категория')).toBeTruthy();
    expect(screen.getByText('61 операция · 384.00 ₾')).toBeTruthy();
    expect(screen.getByText('Показать операции ›')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('Продукты'), 'Еда');
    await tap('Сохранить');
    expect(await screen.findByText('Категория «🛒 Еда» сохранена')).toBeTruthy();
    expect(await screen.findByText('🛒 Еда')).toBeTruthy();
    // the stack's header is native (not drawn here): back by the navigation
    act(() => navigationRef.goBack());
    expect((await screen.findAllByText(/^🛒 Еда · /)).length).toBeGreaterThan(0);
  });

  test('no emoji', async () => {
    await tap('🛒 Продукты');
    await tap('Убрать эмодзи');
    await tap('Сохранить');
    expect(await screen.findByText('Категория «Продукты» сохранена')).toBeTruthy();
    expect((await cat('Продукты')).emoji).toBeNull();
  });

  test('"Показать операции": the operations of it; back returns here', async () => {
    await tap('👕 Одежда');
    await tap('Показать операции ›');
    expect(await screen.findByText('Категория · 1')).toBeTruthy();
    expect(screen.getByText('Возврат · ZARA')).toBeTruthy();
    expect(screen.queryByText('SPAR')).toBeNull();
    await tap('Назад');
    expect(await screen.findByText('Разделы')).toBeTruthy();
  });

  test('"Сбережения": its name stays, it can\'t be deleted', async () => {
    await tap('🏦 Сбережения');
    expect(await screen.findByText(/^Системная категория: сюда уходит то, что бюджет месяца оставил/)).toBeTruthy();
    expect(screen.getByDisplayValue('Сбережения').props.editable).toBe(false);
    expect(screen.queryByText('Удалить категорию')).toBeNull();
  });

  test('"Пополнение счёта": a system one too — what it is for, can\'t be deleted', async () => {
    await tap('💳 Пополнение счёта');
    expect(await screen.findByText(/^Системная категория: сюда попадают все пополнения карты/)).toBeTruthy();
    expect(screen.getByDisplayValue('Пополнение счёта').props.editable).toBe(false);
    expect(screen.queryByText('Удалить категорию')).toBeNull();
  });
});

test('4.3: deleting a section: its categories stay without one', async () => {
  await openCategories(async () => {
    await ops();
    const db = await getDb();
    const { lastInsertRowid: t } = await db.run("INSERT INTO category_types (name, sort_order) VALUES ('Хобби', 5)");
    await db.run("UPDATE categories SET type_id = ? WHERE name IN ('Развлечения', 'Путешествия')", [t]);
  });
  expect(screen.getByText('Хобби')).toBeTruthy();
  await tap('Разделы');
  await tap('Удалить: Хобби');
  expect(await screen.findByText('Удалить раздел «Хобби»?')).toBeTruthy();
  expect(screen.getByText('2 категории останутся без раздела.')).toBeTruthy();
  await tap('Удалить');
  expect(await screen.findByText('Раздел «Хобби» удалён')).toBeTruthy();
  expect((await cat('Развлечения')).type_id).toBeNull();
});

describe('4.3 the sections', () => {
  beforeEach(async () => {
    await openCategories();
    await tap('Разделы');
    await screen.findByText('Эти категории предлагаются для переводов');
  });

  test('a new one; its name taken', async () => {
    await tap('Новый раздел');
    fireEvent.changeText(await screen.findByPlaceholderText('Например, Хобби'), 'Хобби');
    await tap('Создать');
    expect(await screen.findByText('Раздел «Хобби» создан')).toBeTruthy();
    // the first one's sheet gone (sliding away it still has its field)
    await waitFor(() => expect(screen.queryByPlaceholderText('Например, Хобби')).toBeNull());
    await tap('Новый раздел');
    fireEvent.changeText(await screen.findByPlaceholderText('Например, Хобби'), 'хобби');
    await tap('Создать');
    expect(await screen.findByText(/Такой раздел уже есть/)).toBeTruthy();
  });

  test('"Переводы" can\'t be deleted', async () => {
    await tap('Удалить: Переводы');
    expect(await screen.findByText('Системный раздел')).toBeTruthy();
    expect(screen.getByText('«Переводы» нельзя удалить: из него приложение предлагает категории для переводов. Переименовать можно.')).toBeTruthy();
  });
});

describe('4.4 merging', () => {
  beforeEach(() => openCategories(base));

  test('picking: a long press, "Сбережения" not, "Объединить" from two', async () => {
    await longPress('👕 Одежда');
    expect(await screen.findByText('Выбрано: 1')).toBeTruthy();
    expect(screen.queryByText('Объединить (1)')).toBeNull();
    await tap('🏦 Сбережения');
    expect(screen.getByText('Выбрано: 1')).toBeTruthy();
    await tap('💻 Техника');
    expect(await screen.findByText('Объединить (2)')).toBeTruthy();
    await tap('Отмена');
    expect(await screen.findByText('Разделы')).toBeTruthy();
  });

  test('two into one: the name, the history and the plans together', async () => {
    await longPress('🛍️ Покупки');
    await tap('👕 Одежда');
    await tap('Объединить (2)');
    expect(await screen.findByText('Объединить 2 категории')).toBeTruthy();
    expect(screen.getByDisplayValue('Покупки & Одежда')).toBeTruthy();
    await tap('Объединить');
    expect(await screen.findByText('Категории объединены в «Покупки & Одежда»')).toBeTruthy();
    const merged = await cat('Покупки & Одежда');
    expect(await cat('Одежда')).toBeUndefined();
    expect((await q<{ n: number }>("SELECT count(*) AS n FROM transactions WHERE merchant_key IN ('ZARA', 'HM', 'APPLE', 'WOLT') AND category_id = ?", [merged.id]))[0].n).toBe(6);
    expect((await q<{ c: number }>("SELECT category_id AS c FROM merchant_rules WHERE pattern = 'ZARA'"))[0].c).toBe(merged.id);
  });

  test('a name taken in that section: refused', async () => {
    await longPress('🛍️ Покупки');
    await tap('👕 Одежда');
    await tap('Объединить (2)');
    fireEvent.changeText(await screen.findByDisplayValue('Покупки & Одежда'), 'Продукты');
    await tap('Объединить');
    expect(await screen.findByText(/Категория «Продукты» в этом разделе уже есть$/)).toBeTruthy();
  });
});

describe('4.5 deleting', () => {
  beforeEach(() => openCategories(base));

  test('no operations this month: what stays, then it\'s gone', async () => {
    await tap('📦 Пустая');
    await tap('Удалить категорию');
    expect(await screen.findByText('Удалить категорию «📦 Пустая»?')).toBeTruthy();
    expect(screen.getByText(/^В этом месяце операций в ней нет\. 1 операция на 40\.00 ₾ прошлых месяцев останется в «📦 Пустая» — история и отчёты не изменятся\. Мерчант OLDSHOP останется без категории\.$/)).toBeTruthy();
    await tap('Удалить');
    expect(await screen.findByText('Категория «📦 Пустая» удалена')).toBeTruthy();
    expect((await cat('Пустая')).deleted_at).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('📦 Пустая')).toBeNull());
  });

  test('one operation this month: no sorting out', async () => {
    await tap('🛒 Продукты');
    await tap('Удалить категорию');
    expect(await screen.findByText(/^В этом месяце в «🛒 Продукты» 1 операция на 25\.00 ₾\. Перед удалением её нужно перенести в другую категорию\.$/)).toBeTruthy();
    expect(screen.getByText('Перенести в другую категорию')).toBeTruthy();
    expect(screen.queryByText('Разложить по разным категориям')).toBeNull();
  });

  test('all to none: they stay without a category; the merchants lose it', async () => {
    await tap('🛍️ Покупки');
    await tap('Удалить категорию');
    expect(await screen.findByText(/перенести — в одну категорию или разложить по нескольким\.$/)).toBeTruthy();
    await tap('Перенести всё в одну категорию');
    expect(await screen.findByText('Куда перенести 4 операции')).toBeTruthy();
    await tap('⚪️ Без категории');
    await tap('Сохранить');
    expect(await screen.findByText('Удалить «🛍️ Покупки»?')).toBeTruthy();
    expect(screen.getByText(/^• 4 операции на 360\.00 ₾ этого месяца останутся без категории\./)).toBeTruthy();
    expect(screen.getByText(/новые операции придётся размечать вручную/)).toBeTruthy();
    expect(screen.getByText(/• План «🛍️ Покупки» на этот месяц удалится\.$/)).toBeTruthy();
    await tap('Удалить');
    expect(await screen.findByText('Категория «🛍️ Покупки» удалена')).toBeTruthy();
    expect((await q<{ n: number }>("SELECT count(*) AS n FROM merchant_rules WHERE pattern IN ('ZARA', 'HM', 'APPLE')"))[0].n).toBe(0);
  });

  describe('sorting out', () => {
    async function start() {
      await tap('🛍️ Покупки');
      await tap('Удалить категорию');
      await tap('Разложить по разным категориям');
      expect(await screen.findByText(/^Удаление «🛍️ Покупки»: осталось 4 операции на 360\.00 ₾$/)).toBeTruthy();
    }
    test('locked to the category and this month: no category filter, no deleting, dates within the month', async () => {
      await start();
      expect(screen.getByText('По мерчантам')).toBeTruthy();
      expect(screen.queryByText('Применено фильтров: 2')).toBeNull();
      await tap('ZARA');
      expect(screen.getByText('Категория (1)')).toBeTruthy();
      expect(screen.queryByText('Удалить (1)')).toBeNull();
      // the selection's "Отмена" isn't there: the banner's "Отменить" leaves
      await waitFor(() => expect(screen.queryByText('Отмена')).toBeNull());
    });
    test('any way out asks: the tab bar, the gear', async () => {
      await start();
      await tap('Статистика');
      expect(await screen.findByText('Прервать удаление «🛍️ Покупки»?')).toBeTruthy();
      await tap('Продолжить');
      expect(screen.getByText(/^Удаление «🛍️ Покупки»/)).toBeTruthy();
      await tap('Настройки');
      expect(await screen.findByText('Прервать удаление «🛍️ Покупки»?')).toBeTruthy();
      await tap('Прервать');
      expect(await screen.findByText('Валюта')).toBeTruthy();
      expect((await cat('Покупки')).deleted_at).toBeNull();
    });
  });
});

test('4.4.2: merging categories planned differently: how to plan the merged one', async () => {
  await openCategories(async () => {
    await base();
    await setPlanAmount('2026-10', await category('Одежда', '👕'), 20000, 'fixed', 'GEL', 'month');
  });
  await longPress('🛍️ Покупки');
  await tap('👕 Одежда');
  await tap('Объединить (2)');
  expect(await screen.findByText('Суммы складываются: 700 ₾')).toBeTruthy();
  expect(screen.getByText('Категории запланированы по-разному — как планировать объединённую:')).toBeTruthy();
  expect(screen.getByText('Лимит · каждый день')).toBeTruthy();
  expect(screen.getByText('как «Покупки»')).toBeTruthy();
  expect(screen.getByText('как «Одежда»')).toBeTruthy();
  await tap('Обязательный платёж');
  await tap('Объединить');
  expect(await screen.findByText('Категории объединены в «Покупки & Одежда»')).toBeTruthy();
  expect(await q("SELECT p.limit_minor AS a, p.kind FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Покупки & Одежда' AND p.ym = '2026-10'"))
    .toEqual([{ a: 70000, kind: 'fixed' }]);
});
