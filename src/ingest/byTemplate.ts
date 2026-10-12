// Bank messages the built-in parser doesn't understand: read by the user's templates ("Шаблоны сообщений"), else kept
// for marking ("Не распознано"). A new template reads the kept ones too.
import { getDb, Db } from '../db';
import {
  addTemplate, countTemplateMatch, deleteUnparsed, listTemplates, listUnparsed, MessageSource, MessageTemplate, saveUnparsed, UnparsedMessage,
} from '../db/messages';
import type { Kind, ParsedTx } from '../domain/types';
import { bankOfSender } from '../domain/banks';
import { emitTransactionsChanged } from '../domain/events';
import { balanceByTemplate, buildTemplate, matchTemplate, readByTemplate, Role } from '../parsers/template';
import { IncomingSms, IngestResult, smsHash, store } from './store';

/** What a template does with a message: an operation stored, hidden, or nothing (not like it). */
async function apply(t: MessageTemplate, sms: IncomingSms, db: Db): Promise<IngestResult | null> {
  if (t.action === 'hide') return matchTemplate(t.spec, sms.body) ? { status: 'ignored', kept: 'hidden' } : null;
  const parsed = readByTemplate(t.spec, t.kind ?? 'purchase', sms.body);
  return parsed ? store(sms, { ...parsed, bank: bankOfSender(sms.sender).id }, balanceByTemplate(t.spec, sms.body), db) : null;
}

/** On arrival: the first of the user's templates that fits reads it; none — it waits in "Не распознано". */
export async function readByTemplates(sms: IncomingSms, outer?: Db): Promise<IngestResult> {
  const source: MessageSource = sms.source ?? 'sms';
  return (outer ?? await getDb()).transaction(async (db) => {
    for (const t of await listTemplates(source, db, bankOfSender(sms.sender).id)) {
      const res = await apply(t, sms, db);
      if (!res) continue;
      await countTemplateMatch(t.id, 1, db);
      return res;
    }
    const hash = sms.hash ?? smsHash(sms);
    // made an operation already (marked by hand), the bank sent it again
    const made = await db.get<{ id: number }>('SELECT id FROM transactions WHERE sms_hash = ?', [hash]);
    if (made) return { status: 'duplicate', txId: made.id };
    const at = sms.timestamp ? Math.floor(sms.timestamp / 1000) : Math.floor(Date.now() / 1000);
    await saveUnparsed({ source, sender: sms.sender, body: sms.body, received_at: at, hash }, db);
    return { status: 'ignored', kept: 'unparsed' };
  });
}

/** A kept message as it came (its time and its hash: the same message imported again is a duplicate). */
const asSms = (m: { source: MessageSource; sender: string; body: string; received_at: number }, hash?: string): IncomingSms =>
  ({ sender: m.sender, body: m.body, timestamp: m.received_at * 1000, source: m.source, hash });

/** The kept messages a template of `m` may read: from the same source (SMS / push) and bank. */
const sameKind = (a: { source: MessageSource; sender: string }, b: { source: MessageSource; sender: string }) =>
  a.source === b.source && bankOfSender(a.sender).id === bankOfSender(b.sender).id;

/** A template being made: a "hide such" one (`kind` null) is the whole text, nothing marked. */
function templateDraft(body: string, marks: Record<number, Role>, kind: Kind | null) {
  const spec = buildTemplate(body, kind ? marks : {});
  return { spec, kind, action: kind ? 'operation' as const : 'hide' as const };
}

/** The kept messages a template would take now (the preview before saving it), with what each gives. */
export async function previewTemplate(message: { source: MessageSource; sender: string; body: string }, marks: Record<number, Role>, kind: Kind | null) {
  const { spec } = templateDraft(message.body, marks, kind);
  return (await listUnparsed()).filter((m) => sameKind(m, message)).flatMap((m): Array<{ message: UnparsedMessage; parsed: ParsedTx | null }> => {
    if (!kind) return matchTemplate(spec, m.body) ? [{ message: m, parsed: null }] : [];
    const parsed = readByTemplate(spec, kind, m.body);
    return parsed ? [{ message: m, parsed }] : [];
  });
}

/**
 * Saves a template and reads the kept messages like it (operations made, hidden ones dropped); how many it took.
 * `kind` null: a "hide such" one.
 */
export async function saveTemplate(message: { source: MessageSource; sender: string; body: string }, marks: Record<number, Role>, kind: Kind | null): Promise<number> {
  const draft = templateDraft(message.body, marks, kind);
  const kept = (await listUnparsed()).filter((m) => sameKind(m, message));
  const bank = bankOfSender(message.sender).id;
  const db = await getDb();
  const taken = await db.transaction(async (tx) => {
    const id = await addTemplate({ source: message.source, bank, action: draft.action, kind, spec: draft.spec, example: message.body }, tx);
    const t = (await listTemplates(message.source, tx, bank)).find((x) => x.id === id)!;
    const done: number[] = [];
    for (const m of kept) {
      const hash = (await tx.get<{ hash: string }>('SELECT hash FROM unparsed_messages WHERE id = ?', [m.id]))!.hash;
      if (await apply(t, asSms(m, hash), tx)) done.push(m.id);
    }
    await deleteUnparsed(done, tx);
    await countTemplateMatch(id, done.length, tx);
    return done.length;
  });
  emitTransactionsChanged();
  return taken;
}

/** "Создать только эту операцию": the marked message as one operation, no template; it leaves "Не распознано". */
export async function addFromMessage(message: { id: number; source: MessageSource; sender: string; body: string; received_at: number }, marks: Record<number, Role>, kind: Kind): Promise<IngestResult> {
  const spec = buildTemplate(message.body, marks);
  const parsed = readByTemplate(spec, kind, message.body);
  if (!parsed) throw new Error('nothing to read: no amount marked');
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const hash = (await tx.get<{ hash: string }>('SELECT hash FROM unparsed_messages WHERE id = ?', [message.id]))?.hash;
    const r = await store(asSms(message, hash), { ...parsed, bank: bankOfSender(message.sender).id }, balanceByTemplate(spec, message.body), tx);
    await deleteUnparsed([message.id], tx);
    return r;
  });
  emitTransactionsChanged();
  return res;
}
