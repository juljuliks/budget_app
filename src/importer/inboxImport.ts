import { getDb } from '../db';
import { emitTransactionsChanged } from '../events';
import { ingestSms, IngestResult } from '../ingest';
import type { InboxSms } from '../native/smsInbox';

export type InboxImportResult = Record<IngestResult['status'], number>;

/**
 * Past bank SMS from the phone's inbox, through the same parsing and merchant rules as live ones. Already stored ones
 * are skipped: by the same hash a live SMS gets (its service-centre time), and, should a device report the time
 * differently, by the exact text; one stored first by push is caught by the SMS/push twin check.
 */
export async function importInboxSms(messages: InboxSms[]): Promise<InboxImportResult> {
  const db = await getDb();
  const counts: InboxImportResult = { inserted: 0, duplicate: 0, ignored: 0 };
  try {
    for (const m of messages) {
      if (await db.get('SELECT 1 FROM transactions WHERE raw_sms = ? LIMIT 1', [m.body])) {
        counts.duplicate++;
        continue;
      }
      const res = await ingestSms({ sender: m.sender, body: m.body, timestamp: m.dateSent > 0 ? m.dateSent : m.date }, { quiet: true });
      counts[res.status]++;
    }
  } finally {
    emitTransactionsChanged();
  }
  return counts;
}
