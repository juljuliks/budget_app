// «Обновить»: which release on GitHub is newer than the installed build and which of its files is the phone's APK.
import { isNewer, parseVersion, releaseOf } from '../../src/update/releases';

describe('versions', () => {
  it('reads a release version, not a local build', () => {
    expect(parseVersion('1.0.161')).toEqual([1, 0, 161]);
    expect(parseVersion('v1.0.161')).toEqual([1, 0, 161]);
    expect(parseVersion('1.0-dev')).toBeNull();
    expect(parseVersion('dev')).toBeNull();
  });

  it('compares by numbers, not as text', () => {
    expect(isNewer('1.0.162', '1.0.161')).toBe(true);
    expect(isNewer('1.0.100', '1.0.99')).toBe(true);
    expect(isNewer('1.1', '1.0.300')).toBe(true);
    expect(isNewer('1.0.161', '1.0.161')).toBe(false);
    expect(isNewer('1.0.160', '1.0.161')).toBe(false);
  });

  it('never offers an update to a local build', () => {
    expect(isNewer('1.0.161', '1.0-dev')).toBe(false);
  });
});

describe('the release', () => {
  const apk = (name: string) => ({ name, browser_download_url: `https://github.com/x/${name}` });

  it('takes the phone\'s APK', () => {
    expect(releaseOf({ tag_name: 'v1.0.162', assets: [apk('notes.txt'), apk('budget-app-1.0.162-arm64-v8a.apk')] }))
      .toEqual({ version: '1.0.162', apkUrl: 'https://github.com/x/budget-app-1.0.162-arm64-v8a.apk' });
  });

  it('is none without an APK or a version', () => {
    expect(releaseOf({ tag_name: 'v1.0.162', assets: [] })).toBeNull();
    expect(releaseOf({ tag_name: 'Сборка 5', assets: [apk('a.apk')] })).toBeNull();
    expect(releaseOf({})).toBeNull();
  });
});
