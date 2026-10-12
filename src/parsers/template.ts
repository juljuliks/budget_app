// The user's own rules for bank messages the built-in parser doesn't understand ("Шаблоны сообщений"): words of one
// message marked as the amount, the merchant, the date, the balance make a pattern; messages like it are read by it.
// No React, no database: building, matching and reading only (stored by db/templates.ts, applied by ingest).
import type { Kind, ParsedTx } from '../domain/types';
import { normalizeMerchant } from './normalize';

export type Role = 'amount' | 'currency' | 'merchant' | 'date' | 'balance';
/** What a template's capture groups are, in order */
type Slot = Role | 'balanceCurrency';

/** A word to mark: its text (without punctuation) and where it is in the message (the first time it is there). */
export type Word = { text: string; start: number; end: number };

/** A stored template: the regex source and what each group holds. */
export type TemplateSpec = { pattern: string; slots: Slot[] };

/** A number as banks write it: "45.00", "2 843.17", "1,234.56", "09.10.2026" (digits with single separators). */
const NUMBER = '\\d(?:[.,\\u00a0\\u202f ]?\\d)*';
const NUMBER_RE = new RegExp(NUMBER, 'g');
const CURRENCY = 'GEL|USD|EUR|₾|\\$|€';
const CURRENCY_ONLY = new RegExp(`^(?:${CURRENCY})$`, 'i');
const CURRENCY_CODES: Record<string, string> = { '₾': 'GEL', $: 'USD', '€': 'EUR' };
/** an amount with its currency in the same word: "45.00GEL", "GEL45.00" */
const AMOUNT_WITH_CURRENCY = new RegExp(`^(?:(${NUMBER})\\s*(${CURRENCY})|(${CURRENCY})\\s*(${NUMBER}))$`, 'i');

/**
 * The words to mark: without punctuation ("FABRIKA," → "FABRIKA"; a lone "·" is none), a number with a space in it
 * one word ("2 843.17"), each word once — marking it marks its first place in the message.
 */
export function wordsOf(body: string): Word[] {
  const raw: Word[] = [];
  for (const m of body.matchAll(/\S+/g)) {
    const lead = /^[(«"'*]*/.exec(m[0])![0].length;
    const trail = /[,.;:!?)»"']*$/.exec(m[0].slice(lead))![0].length;
    const text = m[0].slice(lead, m[0].length - trail);
    // a word of only punctuation ("·", "-") is nothing to mark; "*1234" keeps its digits
    if (!/[A-Za-zА-Яа-яЁёა-ჰ\d₾$€]/.test(text)) continue;
    raw.push({ text, start: m.index! + lead, end: m.index! + m[0].length - trail });
  }
  const joined: Word[] = [];
  for (const w of raw) {
    const prev = joined[joined.length - 1];
    // "2" "843.17": one number, if only a space is between them
    if (prev && /^\d{1,3}(?: \d{3})*$/.test(prev.text) && /^\d{3}(?:[.,]\d{1,2})?$/.test(w.text) && body.slice(prev.end, w.start) === ' ') {
      joined[joined.length - 1] = { text: `${prev.text} ${w.text}`, start: prev.start, end: w.end };
    } else joined.push(w);
  }
  const seen = new Set<string>();
  return joined.filter((w) => !seen.has(w.text) && !!seen.add(w.text));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text between the marked places: as is, but any number may differ (a balance, a card's digits) and any spacing. */
function literal(text: string): string {
  let out = '';
  let at = 0;
  for (const m of text.matchAll(NUMBER_RE)) {
    out += escape(text.slice(at, m.index!)) + NUMBER;
    at = m.index! + m[0].length;
  }
  return (out + escape(text.slice(at))).replace(/\s+/g, '\\s+');
}

type Span = { start: number; end: number; group: string; slots: Slot[] };

/** The marked words (index in wordsOf → role) as places of the pattern; next words of one merchant / date: one place. */
function spans(body: string, words: Word[], marks: Record<number, Role>): Span[] {
  const out: Span[] = [];
  const byStart = Object.keys(marks).map(Number).sort((a, b) => words[a].start - words[b].start);
  for (let k = 0; k < byStart.length; k++) {
    const w = words[byStart[k]];
    const role = marks[byStart[k]];
    if (role === 'amount' || role === 'balance') {
      const inWord = AMOUNT_WITH_CURRENCY.exec(w.text);
      const cur: Slot = role === 'amount' ? 'currency' : 'balanceCurrency';
      if (inWord) {
        // the currency in the same word: taken from it (marked or not)
        out.push({ start: w.start, end: w.end, group: inWord[1] ? `(${NUMBER})\\s*(${CURRENCY})` : `(${CURRENCY})\\s*(${NUMBER})`, slots: inWord[1] ? [role, cur] : [cur, role] });
        continue;
      }
      out.push({ start: w.start, end: w.end, group: `(${NUMBER})`, slots: [role] });
      // the balance's currency: the word right after it, when it is one (the card's currency, not marked)
      const after = /^\s*(\S+?)[,.;:]?(?:\s|$)/.exec(body.slice(w.end));
      if (role === 'balance' && after && CURRENCY_ONLY.test(after[1])) {
        const at = w.end + after[0].indexOf(after[1]);
        out.push({ start: at, end: at + after[1].length, group: `(${CURRENCY})`, slots: ['balanceCurrency'] });
      }
      continue;
    }
    if (role === 'currency') {
      out.push({ start: w.start, end: w.end, group: `(${CURRENCY})`, slots: ['currency'] });
      continue;
    }
    // a merchant / a date: words that follow each other in the text make one place
    let j = k;
    while (j + 1 < byStart.length && marks[byStart[j + 1]] === role
      && /^[\s,.;:·*-]*$/.test(body.slice(words[byStart[j]].end, words[byStart[j + 1]].start))) j++;
    out.push({ start: w.start, end: words[byStart[j]].end, group: '([\\s\\S]+?)', slots: [role] });
    k = j;
  }
  return out.sort((a, b) => a.start - b.start).filter((s, i, all) => i === 0 || s.start >= all[i - 1].end);
}

/** The template of a message with these words marked; without marks (a "hide such" one) the whole text, numbers free. */
export function buildTemplate(body: string, marks: Record<number, Role> = {}): TemplateSpec {
  const words = wordsOf(body);
  let pattern = '';
  let at = 0;
  const slots: Slot[] = [];
  for (const s of spans(body, words, marks)) {
    pattern += literal(body.slice(at, s.start)) + s.group;
    slots.push(...s.slots);
    at = s.end;
  }
  pattern += literal(body.slice(at));
  return { pattern: `^\\s*${pattern}\\s*$`, slots };
}

/** What a message gives by this template, or null when it isn't like it. */
export function matchTemplate(spec: TemplateSpec, body: string): Partial<Record<Slot, string>> | null {
  const m = new RegExp(spec.pattern, 'i').exec(body);
  if (!m) return null;
  const out: Partial<Record<Slot, string>> = {};
  spec.slots.forEach((slot, i) => { out[slot] = m[i + 1]; });
  return out;
}

/** "2 843.17" → 284317, "1,234.56" → 123456, "12,5" → 1250: the last "." or "," followed by 1–2 digits is the decimal one. */
export function parseNumber(text: string): number | null {
  const s = text.replace(/[\s  ]/g, '');
  const m = /^(\d[\d.,]*?)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const units = Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(units) ? units * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0) : null;
}

/** "09.10.2026 10:00", "9/10/26": the day first (as in Georgia); the time when there is one. */
export function parseDate(text: string): { iso: string; hasTime: boolean } | null {
  const d = /(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})/.exec(text);
  if (!d) return null;
  const t = /(\d{1,2}):(\d{2})/.exec(text.slice(d.index + d[0].length)) ?? /(\d{1,2}):(\d{2})/.exec(text);
  const [day, month] = [Number(d[1]), Number(d[2])];
  const year = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
  const [hour, minute] = t ? [Number(t[1]), Number(t[2])] : [0, 0];
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getMonth() !== month - 1 || date.getDate() !== day || hour > 23 || minute > 59) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return { iso: `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00`, hasTime: !!t };
}

const currencyOf = (s: string | undefined) => (s ? CURRENCY_CODES[s] ?? s.toUpperCase() : 'GEL');
const cleanMerchant = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/[,.;:]+$/, '').trim();

/** The operation a message gives by an operation template (null: not like it, or no amount in it). */
export function readByTemplate(spec: TemplateSpec, kind: Kind, body: string): ParsedTx | null {
  const got = matchTemplate(spec, body);
  const minor = got?.amount ? parseNumber(got.amount) : null;
  if (!got || !minor) return null;
  const merchant = cleanMerchant(got.merchant);
  const date = got.date ? parseDate(got.date) : null;
  return {
    bank: 'tbc',
    kind,
    amount_minor: minor,
    currency: currencyOf(got.currency),
    raw_merchant: merchant,
    merchant_key: normalizeMerchant(merchant),
    ...((kind === 'transfer' || kind === 'deposit') && merchant ? { counterparty: merchant } : {}),
    occurred_at: date?.iso,
    has_time: date?.hasTime ?? false,
    raw_sms: body,
  };
}

/** The card balance a message gives by its template ("Balance: …" marked), if marked. */
export function balanceByTemplate(spec: TemplateSpec, body: string): { minor: number; currency: string } | null {
  const got = matchTemplate(spec, body);
  const minor = got?.balance ? parseNumber(got.balance) : null;
  return got && minor !== null ? { minor, currency: currencyOf(got.balanceCurrency) } : null;
}
