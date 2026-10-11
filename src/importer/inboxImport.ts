import { Db, getDb } from '../db';
import { emitTransactionsChanged } from '../domain/events';
import { ingestSms, IngestResult } from '../ingest/ingest';
import { autoCategorizeRefunds } from '../db/refunds';
import type { InboxSms } from '../native/smsInbox';

export type InboxImportResult = Record<IngestResult['status'], number>;

/** SMS stored per transaction. */
const BATCH = 50;

/** One SMS of the inbox, inside the batch's transaction `tx`. */
async function importOne(m: InboxSms, tx: Db): Promise<IngestResult['status']> {
  if (await tx.get('SELECT 1 FROM transactions WHERE raw_sms = ? LIMIT 1', [m.body])) return 'duplicate';
  const res = await ingestSms({ sender: m.sender, body: m.body, timestamp: m.dateSent > 0 ? m.dateSent : m.date }, { quiet: true, db: tx });
  // past operations: already known to the user, no "new" mark and no unread badge
  if (res.status === 'inserted') await tx.run('UPDATE transactions SET seen_at = ? WHERE id = ? AND seen_at IS NULL', [Math.floor(Date.now() / 1000), res.txId]);
  return res.status;
}

/**
 * Past bank SMS from the phone's inbox, through the same parsing and merchant rules as live ones. Already stored ones
 * are skipped: by the same hash a live SMS gets (its service-centre time), and, should a device report the time
 * differently, by the exact text; one stored first by push is caught by the SMS/push twin check.
 */
export async function importInboxSms(messages: InboxSms[]): Promise<InboxImportResult> {
  const db = await getDb();
  const counts: InboxImportResult = { inserted: 0, duplicate: 0, ignored: 0 };
  try {
    // a batch in one transaction: one write to disk instead of one per statement; a live SMS waits between batches
    for (let i = 0; i < messages.length; i += BATCH) {
      await db.transaction(async (tx) => {
        for (const m of messages.slice(i, i + BATCH)) counts[await importOne(m, tx)]++;
      });
    }
    // past refunds whose purchases came later in the import
    await autoCategorizeRefunds();
  } finally {
    emitTransactionsChanged();
  }
  return counts;
}
