import { openApp, screen } from './app';

test('the app opens on the operations', async () => {
  await openApp();
  expect(await screen.findByText(/Операций пока нет/)).toBeTruthy();
});
