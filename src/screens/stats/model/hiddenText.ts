// "Скрыть суммы" (the eye) on the stats' limit lines: no amounts, only what can't be added up into them — an
// overspend is just the word, what's left is its share of the line's own limit, a moved limit is by how much.
import { formatPercent } from '@/shared/lib/format';

/**
 * "осталось 40%" / "сэкономлено 12%" / "осталось оплатить 40%" — `left` of the line's `limit`; over it: "перерасход".
 * Lower case: the line capitalizes it where it starts.
 */
export function hiddenLeft(left: number, limit: number, word = 'осталось'): string {
  return left < 0 ? 'перерасход' : `${word} ${formatPercent(left, limit)}`;
}

/** A rhythm's limit moved by the spending before: "↓ 16%" / "↑ 8%"; under half a percent — ''. */
export function limitMove(before: number, after: number): string {
  const pct = before > 0 ? Math.round(((after - before) / before) * 100) : 0;
  return pct === 0 ? '' : `${pct < 0 ? '↓' : '↑'} ${Math.abs(pct)}%`;
}
