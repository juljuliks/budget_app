import { back, openApp, screen, tap, openMenu } from './app';

test('the app opens on the operations', async () => {
  await openApp();
  expect(await screen.findByText(/Операций пока нет/)).toBeTruthy();
});

test('9.5 the menu ⋮ in both tabs: Категории, Мерчанты, Настройки, back to the tab', async () => {
  await openApp();
  for (const tab of ['Операции', 'Статистика']) {
    if (tab === 'Статистика') await tap('Статистика');
    await tap('Меню');
    for (const t of ['разделы, эмодзи, вид в плане', 'какая категория у какого магазина', 'бюджет, банки, приложение']) expect(screen.getByText(t)).toBeTruthy();
    await tap('Категории');
    expect(await screen.findByLabelText('Новая категория')).toBeTruthy();
    back();
    await openMenu('Мерчанты');
    expect(await screen.findByPlaceholderText('Найти мерчанта')).toBeTruthy();
    back();
    await openMenu('Настройки');
    expect(await screen.findByText('Валюта')).toBeTruthy();
    back();
    // back on the tab it was opened from
    if (tab === 'Операции') expect(await screen.findByPlaceholderText('Поиск: мерчант, описание, сумма…')).toBeTruthy();
    else expect(await screen.findByLabelText('Динамика трат')).toBeTruthy();
  }
});

test('9.5.1 the settings: their rows and the installed version, no Категории / Мерчанты', async () => {
  await openApp();
  await openMenu('Настройки');
  for (const t of ['Валюта', 'Уведомлять о лимитах', 'Банки', 'Блокировка', 'Шаблоны сообщений', 'Импорт SMS из телефона', 'Резервная копия']) expect(await screen.findByText(t)).toBeTruthy();
  expect(screen.queryByText('Категории')).toBeNull();
  expect(screen.queryByText('Мерчанты')).toBeNull();
  // no native module in tests: "dev"
  expect(screen.getByText('Версия dev')).toBeTruthy();
});
