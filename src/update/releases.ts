// The app's releases on GitHub (.github/workflows/android-release.yml publishes one per push to main: tag v1.0.N,
// the phone's APK budget-app-1.0.N-arm64-v8a.apk): the latest one and whether it is newer than the installed build.

export const LATEST_RELEASE_URL = 'https://api.github.com/repos/juljuliks/budget_app/releases/latest';

export type Release = { version: string; apkUrl: string };

/** "1.0.42" → [1, 0, 42]; a local build ("1.0-dev", "dev") → null: it is never offered an update. */
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+(?:\.\d+)*)$/.exec(v.trim());
  return m ? m[1].split('.').map(Number) : null;
}

/** `latest` is a later version than `current`; false if either isn't a release version. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

type GithubRelease = { tag_name?: string; assets?: { name?: string; browser_download_url?: string }[] };

/** The release from GitHub's answer: its version and the phone's APK; null when it has no APK. */
export function releaseOf(json: GithubRelease): Release | null {
  const version = json.tag_name?.replace(/^v/, '');
  const apks = (json.assets ?? []).filter((a) => a.name?.endsWith('.apk') && a.browser_download_url);
  const apk = apks.find((a) => a.name?.includes('arm64')) ?? apks[0];
  return version && parseVersion(version) && apk ? { version, apkUrl: apk.browser_download_url! } : null;
}

/** The latest release; throws on no network or a bad answer. */
export async function fetchLatestRelease(): Promise<Release | null> {
  const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`releases: HTTP ${res.status}`);
  return releaseOf(await res.json());
}
