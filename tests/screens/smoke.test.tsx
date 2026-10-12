import { openApp, screen, tap } from './app';

test('the app opens on the operations', async () => {
  await openApp();
  expect(await screen.findByText(/Операций пока нет/)).toBeTruthy();
});

test('9.5 the gear opens the settings: their rows and the installed version', async () => {
  await openApp();
  await tap('Настройки');
  for (const t of ['Валюта', 'Уведомлять о лимитах', 'Мерчанты', 'Категории', 'Блокировка', 'Импорт SMS из телефона', 'Резервная копия']) expect(await screen.findByText(t)).toBeTruthy();
  // no native module in tests: "dev"
  expect(screen.getByText('Версия dev')).toBeTruthy();
});
