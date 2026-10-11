// The operations as a table (CSV) for a spreadsheet: Excel / Google Sheets with a Russian locale.
import { getDb } from '../db';
import { isIncome, KIND_LABELS } from '@/shared/lib/format';

export type CsvOperation = {
  occurred_at: number;
  amount_minor: number;
  currency: string;
  kind: string;
  category: string | null;
  type_name: string | null;
  merchant: string | null;
  note: string | null;
};

const HEADER = ['Дата', 'Сумма', 'Валюта', 'Тип', 'Категория', 'Раздел', 'Мерчант', 'Заметка'];

const p2 = (n: number) => String(n).padStart(2, '0');
const dateOf = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
/** Spending negative, money in positive; a decimal comma (the separator is ";"), no spaces: a number for the spreadsheet. */
const amountOf = (o: CsvOperation) => `${isIncome(o.kind) ? '' : '-'}${(Math.abs(o.amount_minor) / 100).toFixed(2).replace('.', ',')}`;
/** Quoted when it holds the separator, a quote or a line break. */
const cell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The CSV text: a BOM (Excel then reads UTF-8), ";" between cells, CRLF between rows. */
export function operationsCsv(rows: CsvOperation[]): string {
  const lines = [HEADER, ...rows.map((o) => [
    dateOf(o.occurred_at), amountOf(o), o.currency, KIND_LABELS[o.kind] ?? o.kind, o.category ?? 'Без категории',
    o.type_name ?? '', o.merchant ?? '', o.note ?? '',
  ])];
  return `﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
}

/** Every operation, oldest first. */
export async function csvOperations(): Promise<CsvOperation[]> {
  return (await getDb()).all<CsvOperation>(
    `SELECT t.occurred_at, t.amount_minor, t.currency, t.kind, c.name AS category, ct.name AS type_name, t.raw_merchant AS merchant, t.note
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN category_types ct ON ct.id = c.type_id
      ORDER BY t.occurred_at, t.id`);
}
