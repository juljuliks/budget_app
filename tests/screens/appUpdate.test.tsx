// 9.13: «Обновить» — a newer release on GitHub said by a toast on start and in «Настройки», its APK downloaded and
// handed to the system installer. GitHub (fetch) and the native module are mocked; the system's "Обновить?" and the
// permission screen — by hand on the phone.
import { act } from '@testing-library/react-native';
import { openApp, screen, tap, texts, openSettings } from './app';

const mockNative = {
  canInstall: jest.fn(async () => true),
  download: jest.fn(async (_url: string, onProgress: (p: number) => void) => { onProgress(40); return '/cache/updates/update.apk'; }),
  install: jest.fn(async (_path: string) => {}),
  openInstallSettings: jest.fn(),
};
jest.mock('../../src/native/appInfo', () => ({ appVersion: () => '1.0.161' }));
jest.mock('../../src/native/appUpdate', () => ({
  canSelfUpdate: () => true,
  canInstallApps: () => mockNative.canInstall(),
  downloadApk: (url: string, onProgress: (p: number) => void) => mockNative.download(url, onProgress),
  installApk: (path: string) => mockNative.install(path),
  openInstallSettings: () => mockNative.openInstallSettings(),
}));

const APK = 'https://github.com/juljuliks/budget_app/releases/download/v1.0.162/budget-app-1.0.162-arm64-v8a.apk';
let latest = '1.0.162';
const fetchMock = jest.fn(async () => ({
  ok: true,
  json: async () => ({ tag_name: `v${latest}`, assets: [{ name: `budget-app-${latest}-arm64-v8a.apk`, browser_download_url: APK }] }),
}));

beforeEach(() => {
  latest = '1.0.162';
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Object.values(mockNative).forEach((m) => m.mockClear());
});

it('9.13.1 a newer release: the toast on start → «Обновить» → downloaded and given to the installer', async () => {
  await openApp();
  await screen.findByText('Доступна версия 1.0.162');
  await tap('Обновить');
  await act(async () => {});
  expect(mockNative.download).toHaveBeenCalledWith(APK, expect.any(Function));
  expect(mockNative.install).toHaveBeenCalledWith('/cache/updates/update.apk');
});

it('9.13.2 «Настройки»: «Обновить до 1.0.162»', async () => {
  await openApp();
  await openSettings('Приложение');
  await tap('Обновить до 1.0.162');
  await act(async () => {});
  expect(mockNative.install).toHaveBeenCalledWith('/cache/updates/update.apk');
  expect(texts()).toContain('Версия 1.0.161');
});

it('9.13.3 no permission to install: asked first, «Открыть настройки» — the system\'s switch', async () => {
  mockNative.canInstall.mockResolvedValueOnce(false);
  await openApp();
  await openSettings('Приложение');
  await tap('Обновить до 1.0.162');
  await screen.findByText('Разрешите установку');
  await tap('Открыть настройки');
  expect(mockNative.openInstallSettings).toHaveBeenCalled();
  expect(mockNative.download).not.toHaveBeenCalled();
});

it('9.13.4 the latest is installed: «Версия 1.0.161 · последняя», no button', async () => {
  latest = '1.0.161';
  await openApp();
  await openSettings('Приложение');
  await screen.findByText('Версия 1.0.161 · последняя');
  expect(screen.queryByText(/^Обновить до/)).toBeNull();
});

it('9.13.5 the download failed: a red toast', async () => {
  mockNative.download.mockRejectedValueOnce(new Error('offline'));
  await openApp();
  await openSettings('Приложение');
  await tap('Обновить до 1.0.162');
  await screen.findByText('⚠️  Не удалось скачать обновление');
  expect(mockNative.install).not.toHaveBeenCalled();
});
