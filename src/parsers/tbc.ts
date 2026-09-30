import { Kind, ParsedTx } from '../types';
import { normalizeMerchant } from '../normalize';

// Amount + currency, either "44.00GEL" / "1,234.56 GEL" or "GEL 44.00" / "$9.99".
// Thousands separators: comma or (narrow) no-break space, always followed by exactly 3 digits,
// so "1,5 GEL" is still read as 1.50. A plain space is NOT a thousands separator: it would glue
// unrelated numbers together.
const NUM = '(\\d{1,3}(?:[,\\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?';
const CUR = '(GEL|USD|EUR|₾|\\$|€)';
const AMOUNT_AFTER = new RegExp(`${NUM}\\s*${CUR}`, 'i');
const AMOUNT_BEFORE = new RegExp(`${CUR}\\s*${NUM}`, 'i');
const CURRENCY_CODES: Record<string, string> = { '₾': 'GEL', '$': 'USD', '€': 'EUR' };

const DATE_TIME = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\s+(\d{1,2}):(\d{2}))?/;
const CARD_MASK = /\(\*[^)]+\)/;
const BALANCE_LINE = /^(balance|available)\b/i;

// Wording of non-purchase SMS is a best guess (no real samples in fixtures yet) — extend with real SMS.
const DECLINED = /declin|reject|insufficient|unsuccessful|not enough|\bfailed\b|отклон|отказ|недостаточно/i;
const REFUND = /refund|reversal|\breturn(ed)?\b|возврат/i;
const DEPOSIT = /deposit money|deposit:|credited|зачислен/i;
const TRANSFER = /money transfer|money transferred|transfer:/i;
const WITHDRAWAL = /cash withdrawal|withdrawal|\bATM\b|снятие наличных/i;

type Amount = { minor: number; currency: string };

function parseAmountLine(line: string): Amount | null {
  const after = AMOUNT_AFTER.exec(line);
  const before = AMOUNT_BEFORE.exec(line);
  // pick whichever occurs first in the line
  let intPart: string, frac: string | undefined, cur: string;
  if (after && (!before || after.index <= before.index)) {
    [, intPart, frac, cur] = after;
  } else if (before) {
    [, cur, intPart, frac] = before;
  } else {
    return null;
  }
  const units = Number(intPart.replace(/[^\d]/g, ''));
  const cents = frac ? Number(frac.padEnd(2, '0')) : 0;
  const code = CURRENCY_CODES[cur] ?? cur.toUpperCase();
  return { minor: units * 100 + cents, currency: code };
}

/** First amount that is not on a "Balance: ..." line. */
function findAmount(lines: string[]): Amount | null {
  for (const line of lines) {
    if (BALANCE_LINE.test(line)) continue;
    const a = parseAmountLine(line);
    if (a) return a;
  }
  return null;
}

/** Validated local date-time; null for impossible dates like 31/02. */
function findDate(text: string): { iso: string; hasTime: boolean } | null {
  const m = DATE_TIME.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const hasTime = m[4] !== undefined;
  const hour = hasTime ? Number(m[4]) : 0;
  const minute = hasTime ? Number(m[5]) : 0;

  const d = new Date(year, month - 1, day, hour, minute);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day || hour > 23 || minute > 59) {
    return null;
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return { iso: `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00`, hasTime };
}

function classify(text: string): Kind | null {
  if (REFUND.test(text)) return 'refund';
  if (DEPOSIT.test(text)) return 'deposit';
  if (TRANSFER.test(text)) return 'transfer';
  if (WITHDRAWAL.test(text)) return 'withdrawal';
  // A plain card purchase always carries the masked card "(*XXXX)"; without it this is
  // not a transaction SMS we understand (promo, OTP, personal message).
  if (CARD_MASK.test(text)) return 'purchase';
  return null;
}

export function parseTbc(raw_sms: string): ParsedTx | null {
  const text = raw_sms.replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  if (DECLINED.test(text)) return null;

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // balance-only SMS end up here too: amounts on "Balance:" lines are skipped
  const amount = findAmount(lines);
  if (!amount || amount.minor === 0) return null;

  const kind = classify(text);
  if (!kind) return null;

  const merchant = extractMerchant(lines);
  const date = findDate(text);
  return {
    bank: 'tbc',
    kind,
    amount_minor: amount.minor,
    currency: amount.currency,
    raw_merchant: merchant,
    merchant_key: normalizeMerchant(merchant),
    ...(kind === 'transfer' ? { counterparty: merchant } : {}),
    occurred_at: date?.iso,
    has_time: date?.hasTime ?? false,
    raw_sms,
  };
}

// Payment gateways prefix the merchant: "LTD KEEPZ.ME*YANDEX GO" -> "YANDEX GO".
// But some merchants append an order id instead: "AMZN Mktp US*2K3AB" -> "AMZN Mktp US".
function stripGateway(line: string): string {
  const parts = line.split('*').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return line;
  const last = parts[parts.length - 1];
  const looksLikeId = /^[A-Z0-9]{3,12}$/i.test(last) && /\d/.test(last);
  return looksLikeId ? parts[parts.length - 2] : last;
}

/** Merchant is the first "free text" line after the amount line (TBC puts it after the card mask). */
function extractMerchant(lines: string[]): string {
  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (BALANCE_LINE.test(line)) continue;
    if (/^https?:/i.test(line)) continue;
    if (parseAmountLine(line) && line.replace(AMOUNT_AFTER, '').replace(AMOUNT_BEFORE, '').trim() === '') continue;
    const candidate = stripGateway(line.replace(CARD_MASK, '').replace(DATE_TIME, '').trim());
    if (candidate) return candidate;
  }
  return '';
}

export default parseTbc;
