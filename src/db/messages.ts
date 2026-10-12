// Bank messages no operation came from ("Не распознано") and the user's templates for them ("Шаблоны сообщений").
// Matching a message against the templates is parsers/template.ts; applying them on arrival — ingest.
import { getDb } from './index';
import type { Db } from './types';
import type { Kind } from '../domain/types';
import type { TemplateSpec } from '../parsers/template';

export type MessageSource = 'sms' | 'push';

/** A message kept for marking: the bank's text as it came. */
export type UnparsedMessage = { id: number; source: MessageSource; sender: string; body: string; received_at: number };

/** A message not read is kept this long: it may hold a one-time code, nothing to keep forever. */
export const UNPARSED_KEEP_S = 30 * 86400;

export type MessageTemplate = {
  id: number;
  source: MessageSource;
  /** 'operation': read as an operation of `kind`; 'hide': such messages are dropped ("Не операция") */
  action: 'operation' | 'hide';
  kind: Kind | null;
  spec: TemplateSpec;
  /** the message it was made from (shown in "Шаблоны сообщений") */
  example: string;
  matched: number;
  last_matched_at: number | null;
};

/** Keeps a message nothing read (the same one twice — once). */
export async function saveUnparsed(m: Omit<UnparsedMessage, 'id'> & { hash: string }, db?: Db) {
  db ??= await getDb();
  await db.run('INSERT OR IGNORE INTO unparsed_messages (source, sender, body, received_at, hash) VALUES (?, ?, ?, ?, ?)',
    [m.source, m.sender, m.body, m.received_at, m.hash]);
}

/** Newest first; the ones older than UNPARSED_KEEP_S are dropped first. */
export async function listUnparsed(now = Math.floor(Date.now() / 1000)): Promise<UnparsedMessage[]> {
  const db = await getDb();
  await db.run('DELETE FROM unparsed_messages WHERE received_at < ?', [now - UNPARSED_KEEP_S]);
  return db.all<UnparsedMessage>('SELECT id, source, sender, body, received_at FROM unparsed_messages ORDER BY received_at DESC, id DESC');
}

export async function countUnparsed(now = Math.floor(Date.now() / 1000)): Promise<number> {
  const db = await getDb();
  return (await db.get<{ n: number }>('SELECT count(*) AS n FROM unparsed_messages WHERE received_at >= ?', [now - UNPARSED_KEEP_S]))!.n;
}

export async function getUnparsed(id: number): Promise<UnparsedMessage | undefined> {
  const db = await getDb();
  return db.get<UnparsedMessage>('SELECT id, source, sender, body, received_at FROM unparsed_messages WHERE id = ?', [id]);
}

export async function deleteUnparsed(ids: number[], db?: Db) {
  db ??= await getDb();
  for (const id of ids) await db.run('DELETE FROM unparsed_messages WHERE id = ?', [id]);
}

type TemplateRow = Omit<MessageTemplate, 'spec'> & { pattern: string; slots: string };
const toTemplate = ({ pattern, slots, ...r }: TemplateRow): MessageTemplate => ({ ...r, spec: { pattern, slots: JSON.parse(slots) } });

/** The templates for messages of this source (all when not given), the oldest first: the first that fits reads it. */
export async function listTemplates(source?: MessageSource, db?: Db): Promise<MessageTemplate[]> {
  db ??= await getDb();
  const rows = await db.all<TemplateRow>(
    `SELECT id, source, action, kind, pattern, slots, example, matched, last_matched_at FROM message_templates
      ${source ? 'WHERE source = ?' : ''} ORDER BY id`, source ? [source] : []);
  return rows.map(toTemplate);
}

export async function addTemplate(t: Pick<MessageTemplate, 'source' | 'action' | 'kind' | 'spec' | 'example'>, db?: Db): Promise<number> {
  db ??= await getDb();
  const { lastInsertRowid } = await db.run(
    'INSERT INTO message_templates (source, action, kind, pattern, slots, example, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [t.source, t.action, t.kind, t.spec.pattern, JSON.stringify(t.spec.slots), t.example, Math.floor(Date.now() / 1000)]);
  return lastInsertRowid;
}

/** A message read (or hidden) by the template: counted, for "Разобрано: N". */
export async function countTemplateMatch(id: number, n = 1, db?: Db) {
  db ??= await getDb();
  await db.run('UPDATE message_templates SET matched = matched + ?, last_matched_at = ? WHERE id = ?', [n, Math.floor(Date.now() / 1000), id]);
}

/** One template gone (null: all of them, "Сбросить все шаблоны"); the operations made by them stay. */
export async function deleteTemplates(id: number | null) {
  const db = await getDb();
  if (id === null) await db.run('DELETE FROM message_templates');
  else await db.run('DELETE FROM message_templates WHERE id = ?', [id]);
}
