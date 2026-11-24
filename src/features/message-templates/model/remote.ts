// The bank's templates from Remote Config on the app's start: checked, kept for the headless SMS task, and the kept
// messages ("Не распознано") read by them when they changed. A template that doesn't check out — dropped, said to the
// crash reports (console.error).
import { saveRemoteTemplates } from '@/db/messages';
import { readKeptByRemote } from '@/ingest/byTemplate';
import { parseRemoteTemplates } from '@/parsers/remoteTemplates';
import { remoteString } from '@/native/remoteConfig';

export const REMOTE_PARAM = 'message_templates';

export async function syncRemoteTemplates(): Promise<void> {
  try {
    const json = await remoteString(REMOTE_PARAM);
    // no Firebase or never set: the kept ones stay (offline is the native side's last value)
    if (json === null || json === '') return;
    const { templates, dropped } = parseRemoteTemplates(json);
    if (dropped.length) console.error('remote templates dropped', dropped.join('; '));
    if (await saveRemoteTemplates(templates)) await readKeptByRemote();
  } catch (e) {
    console.error('remote templates sync failed', e);
  }
}
