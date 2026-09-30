import { ParsedTx } from '../types';
import { normalizeMerchant } from '../normalize';

const amountRe = /([0-9]+[.,][0-9]{1,2})\s*(GEL|USD|EUR|₾|\$|€)?/i;
const dateTimeRe = /(\d{2}\/\d{2}\/\d{2,4})(?:\s+(\d{2}:\d{2}))?/;

export function parseTbc(raw_sms: string): ParsedTx | null {
  const text = raw_sms.replace(/\r/g, '\n').trim();
  if (!text) return null;

  // ignore balance-only
  if (/^balance:/i.test(text)) return null;

  // deposit
  const depositMatch = /deposit money|deposit:|credited/i;
  if (depositMatch.test(text)) {
    const a = amountRe.exec(text);
    const dateM = dateTimeRe.exec(text);
    return {
      bank: 'tbc',
      kind: 'deposit',
      amount_minor: a ? Math.round(parseFloat(a[1].replace(',', '.')) * 100) : 0,
      currency: (a && a[2]) ? a[2].toUpperCase() : 'GEL',
      raw_merchant: extractMerchant(text),
      merchant_key: normalizeMerchant(extractMerchant(text)),
      occurred_at: dateM ? toIso(dateM[1], dateM[2]) : new Date().toISOString(),
      raw_sms
    };
  }

  // money transfer
  if (/money transfer|money transferred|transfer:/i.test(text)) {
    const a = amountRe.exec(text);
    const dateM = dateTimeRe.exec(text);
    const counterparty = extractMerchant(text);
    return {
      bank: 'tbc',
      kind: 'transfer',
      amount_minor: a ? Math.round(parseFloat(a[1].replace(',', '.')) * 100) : 0,
      currency: (a && a[2]) ? a[2].toUpperCase() : 'GEL',
      raw_merchant: counterparty,
      merchant_key: normalizeMerchant(counterparty),
      counterparty,
      occurred_at: dateM ? toIso(dateM[1], dateM[2]) : new Date().toISOString(),
      raw_sms
    };
  }

  // purchase (default if amount and merchant present)
  const a = amountRe.exec(text);
  if (a) {
    const dateM = dateTimeRe.exec(text);
    const merchant = extractMerchant(text);
    return {
      bank: 'tbc',
      kind: 'purchase',
      amount_minor: Math.round(parseFloat(a[1].replace(',', '.')) * 100),
      currency: (a && a[2]) ? a[2].toUpperCase() : 'GEL',
      raw_merchant: merchant,
      merchant_key: normalizeMerchant(merchant),
      occurred_at: dateM ? toIso(dateM[1], dateM[2]) : new Date().toISOString(),
      raw_sms
    };
  }

  return null;
}

function extractMerchant(text: string): string {
  // heuristic: merchant often on its own line after amount or before Balance
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    // try last 3 lines
    for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
      const cand = lines[i];
      // skip masked card markers and balance lines and urls
      if (/^\(\*[^)]+\)$/.test(cand)) continue;
      if (/^balance:/i.test(cand)) continue;
      if (/^https?:/i.test(cand)) continue;
      // if line contains a currency only, skip
      if (/^[0-9.,]+\s*(GEL|USD|EUR|₾|\$|€)?$/i.test(cand)) continue;
      // if contains gateway pattern like KEEPZ.ME*YANDEX GO, take part after '*'
      if (cand.includes('*')) {
        const parts = cand.split('*').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return parts[parts.length - 1].replace(dateTimeRe, '').trim();
      }
      // strip trailing date/time if present
      return cand.replace(dateTimeRe, '').trim();
    }
  }
  const first = lines[0] || '';
  if (first.includes('*')) {
    const parts = first.split('*').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1].replace(dateTimeRe, '').trim();
  }
  return first.replace(dateTimeRe, '').trim();
}

function toIso(datePart: string, timePart?: string) {
  // datePart like DD/MM/YY or DD/MM/YYYY
  const parts = datePart.split('/');
  let day = parts[0];
  let month = parts[1];
  let year = parts[2];
  if (year.length === 2) year = '20' + year;
  const iso = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${(timePart||'00:00')}:00`;
  return iso;
}

export default parseTbc;
