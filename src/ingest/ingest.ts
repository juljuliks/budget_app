import parseTbc, { isNotOperation, parseTbcBalance } from '../parsers/tbc';
import { recordBalance } from '../db/balance';
import { getDb, Db } from '../db';
import { bankOfSender } from '../domain/banks';
import { emitTransactionsChanged } from '../domain/events';
import { IncomingSms, IngestResult, resolveOccurredAt, store } from './store';
import { readByTemplates } from './byTemplate';

export { CROSS_SOURCE_WINDOW_S, resolveOccurredAt, smsHash } from './store';
export type { IncomingSms, IngestResult } from './store';

/**
 * Parses one SMS, stores it and applies merchant rules. Shared by the headless task and importer. `db`: the handle of
 * the import's transaction (a batch of SMS stored together).
 */
export async function ingestSms(sms: IncomingSms, opts: { quiet?: boolean; db?: Db } = {}): Promise<IngestResult> {
  // a batch import announces the change once at the end, not per SMS
  const changed = () => { if (!opts.quiet) emitTransactionsChanged(); };
  // which bank's (by the sender): one without a parser of its own goes to its templates right away
  const bank = bankOfSender(sms.sender);
  const parsed = bank.builtIn ? parseTbc(sms.body) : null;
  const balance = bank.builtIn ? parseTbcBalance(sms.body) : null;
  if (!parsed) {
    // a balance-only SMS ("Balance: 281.00GEL"): not a transaction, but keeps the card balance in sync
    if (balance) {
      await recordBalance({ minor: balance.minor, currency: balance.currency, at: resolveOccurredAt(balance, sms.timestamp), txId: null }, opts.db, bank.id);
      changed();
      return { status: 'ignored' };
    }
    // a code, a declined payment, a conversion: not an operation, nothing to keep
    if (bank.builtIn && isNotOperation(sms.body)) return { status: 'ignored' };
    // the user's templates (the bank's); else kept for marking ("Не распознано")
    const res = await readByTemplates(sms, opts.db);
    if (res.status === 'inserted' || (res.status === 'ignored' && res.kept === 'unparsed')) changed();
    return res;
  }

  // from the twin check to the balance in one transaction: an SMS and a push of one operation arriving together are
  // stored one after the other, so the second one sees the first as its twin (inside an import: its batch's)
  const res = await (opts.db ?? await getDb()).transaction((tx) => store(sms, parsed, balance, tx));
  if (res.status === 'inserted') changed();
  return res;
}

export default ingestSms;
