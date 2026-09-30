// Node-only: imports SMS fixtures into the local DB (see scripts/run_importer.js).
import fs from 'fs';
import { ingestSms, IngestResult } from '../ingest';

export async function importFixtures(fixturesPath: string) {
  const items: Array<{ raw_sms: string; sender?: string; timestamp?: number }> =
    JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
  const counts: Record<IngestResult['status'], number> = { inserted: 0, duplicate: 0, ignored: 0 };
  for (const item of items) {
    const res = await ingestSms({ sender: item.sender || '', body: item.raw_sms, timestamp: item.timestamp });
    counts[res.status]++;
  }
  return counts;
}
