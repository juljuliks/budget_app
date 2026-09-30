const INCOME_KINDS = new Set(['deposit', 'refund']);

export function formatAmount(amountMinor: number, currency: string, kind?: string): string {
  const sign = kind && INCOME_KINDS.has(kind) ? '+' : '−';
  return `${sign}${(amountMinor / 100).toFixed(2)} ${currency}`;
}

export function isIncome(kind: string) {
  return INCOME_KINDS.has(kind);
}

export function dayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Hand-rolled: Hermes on RN 0.71 has limited Intl support
export function formatDay(unixSeconds: number, now = new Date()): string {
  const d = new Date(unixSeconds * 1000);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
