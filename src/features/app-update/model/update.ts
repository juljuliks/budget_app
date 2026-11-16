// The newer release, if there is one, and «Обновить»: its APK downloaded and handed to the system installer. One
// state for the whole app: the toast on start and the row in the settings show the same download.
import { fetchLatestRelease, isNewer, parseVersion, type Release } from '@/update/releases';
import { appVersion } from '@/native/appInfo';
import { canInstallApps, canSelfUpdate, downloadApk, installApk, openInstallSettings } from '@/native/appUpdate';
import { getSetting, setSetting } from '@/db/settings';
import { CANCEL } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { ALLOW_TEXT, ALLOW_TITLE, OPEN_SETTINGS, UPDATE, UPDATE_FAILED, updateAvailable } from '../texts';

export type UpdateState = {
  /** a release newer than this build */
  latest: Release | null;
  /** GitHub was asked and answered (the build is the latest when `latest` is null) */
  checked: boolean;
  /** downloading: 0..100, -1 while the size isn't known; null otherwise */
  progress: number | null;
};

/** GitHub is asked at most this often on start and on coming back to the app (the settings ask when opened). */
const CHECK_EVERY_MS = 6 * 3600_000;
/** the version the toast on start was shown for: once per version */
const OFFERED_KEY = 'update_offered';

let state: UpdateState = { latest: null, checked: false, progress: null };
let checkedAt = 0;
const listeners = new Set<() => void>();

export const updateState = () => state;
export function onUpdateState(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** A release build that can install another one (a local build, "1.0-dev", and the tests never check). */
export const updatesOn = () => canSelfUpdate() && parseVersion(appVersion()) != null;

/** Asks GitHub for the latest release, unless asked within CHECK_EVERY_MS (`force`: anyway). */
export async function checkForUpdate(force = false): Promise<Release | null> {
  if (!updatesOn()) return null;
  if (!force && Date.now() - checkedAt < CHECK_EVERY_MS) return state.latest;
  const release = await fetchLatestRelease();
  checkedAt = Date.now();
  set({ latest: release && isNewer(release.version, appVersion()) ? release : null, checked: true });
  return state.latest;
}

/** On start and on coming back: a newer release is said by a toast with «Обновить» — once per version. */
export async function offerUpdate(): Promise<void> {
  try {
    const release = await checkForUpdate();
    if (!release || (await getSetting(OFFERED_KEY)) === release.version) return;
    await setSetting(OFFERED_KEY, release.version);
    toast(updateAvailable(release.version), { label: UPDATE, onPress: () => { startUpdate(); } });
  } catch (e) {
    // no network: the settings show the version without «последняя»
    console.warn('update check failed', e);
  }
}

/** «Обновить»: the permission to install asked first, then the download, then the system's "Обновить?". */
export async function startUpdate(): Promise<void> {
  const release = state.latest;
  if (!release || state.progress != null) return;
  if (!(await canInstallApps())) {
    sheetAlert(ALLOW_TITLE, ALLOW_TEXT, [{ text: OPEN_SETTINGS, onPress: openInstallSettings }, { text: CANCEL, style: 'cancel' }]);
    return;
  }
  set({ progress: -1 });
  try {
    const path = await downloadApk(release.apkUrl, (percent) => set({ progress: percent }));
    await installApk(path);
  } catch (e) {
    console.warn('update failed', e);
    toastError(UPDATE_FAILED);
  } finally {
    set({ progress: null });
  }
}
