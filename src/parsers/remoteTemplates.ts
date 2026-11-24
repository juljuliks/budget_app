// The bank's message templates sent to every phone (Firebase Remote Config, parameter "message_templates"): the same
// templates as the user's own ("Шаблоны сообщений", parsers/template.ts), read after them — a new format of the bank
// read without a new release. Checked before use: a template that doesn't read its own example is dropped. No React.
import type { Kind } from '../domain/types';
import { matchTemplate, readByTemplate, type TemplateSpec } from './template';

/** The shape of the parameter this build understands; another one — ignored whole (an older app, a newer schema). */
export const REMOTE_SCHEMA = 1;

export type RemoteTemplate = {
  /** stable name, e.g. "tbc-sms-purchase-2026-12" */
  key: string;
  source: 'sms' | 'push';
  /** whose messages it reads (BankId) */
  bank: string;
  action: 'operation' | 'hide';
  kind: Kind | null;
  spec: TemplateSpec;
  /** a real message it reads: the check before use */
  example: string;
};

const KINDS: Kind[] = ['purchase', 'payment', 'refund', 'withdrawal', 'transfer', 'deposit'];
const SLOTS = ['amount', 'currency', 'merchant', 'date', 'balance', 'balanceCurrency'];

/** One entry checked: a reason it is dropped, or the template. */
function check(raw: unknown): RemoteTemplate | string {
  const t = raw as Record<string, unknown>;
  if (!t || typeof t !== 'object') return 'not an object';
  const key = typeof t.key === 'string' && t.key ? t.key : null;
  if (!key) return 'no key';
  if (t.source !== 'sms' && t.source !== 'push') return `${key}: source`;
  if (typeof t.bank !== 'string' || !t.bank) return `${key}: bank`;
  if (t.action !== 'operation' && t.action !== 'hide') return `${key}: action`;
  const kind = t.action === 'operation' ? (KINDS.includes(t.kind as Kind) ? t.kind as Kind : null) : null;
  if (t.action === 'operation' && !kind) return `${key}: kind`;
  if (typeof t.pattern !== 'string' || !Array.isArray(t.slots) || !t.slots.every((s) => SLOTS.includes(s as string))) return `${key}: pattern / slots`;
  if (t.action === 'operation' && !t.slots.includes('amount')) return `${key}: no amount`;
  try {
    new RegExp(t.pattern, 'i');
  } catch {
    return `${key}: bad pattern`;
  }
  if (typeof t.example !== 'string' || !t.example) return `${key}: no example`;
  const spec = { pattern: t.pattern, slots: t.slots } as TemplateSpec;
  // it must read the message it was made from
  const reads = kind ? !!readByTemplate(spec, kind, t.example) : !!matchTemplate(spec, t.example);
  if (!reads) return `${key}: doesn't read its example`;
  return { key, source: t.source, bank: t.bank, action: t.action, kind, spec, example: t.example };
}

/** The parameter's JSON: the templates fit to use, and why the others were dropped. */
export function parseRemoteTemplates(json: string): { templates: RemoteTemplate[]; dropped: string[] } {
  let data: { schema?: unknown; templates?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    return { templates: [], dropped: ['not JSON'] };
  }
  if (data?.schema !== REMOTE_SCHEMA) return { templates: [], dropped: [`schema ${String(data?.schema)}`] };
  const templates: RemoteTemplate[] = [];
  const dropped: string[] = [];
  for (const raw of Array.isArray(data.templates) ? data.templates : []) {
    const r = check(raw);
    if (typeof r === 'string') dropped.push(r);
    else templates.push(r);
  }
  return { templates, dropped };
}
