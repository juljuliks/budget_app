/** "12,50" / "12.5" / "1 200" -> 1250 / 1250 / 120000 minor units; null if not a positive amount. */
export function parseAmountInput(input: string): number | null {
  const s = input.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [units, frac = ''] = s.split('.');
  const minor = Number(units) * 100 + Number(frac.padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

/** 123456 -> "1 234.56"; whole amounts drop the decimals when `compact`. */
export function formatMoney(minor: number, opts: { compact?: boolean } = {}): string {
  const sign = minor < 0 ? '−' : '';
  const abs = Math.abs(minor);
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (opts.compact && cents === 0) return `${sign}${grouped}`;
  return `${sign}${grouped}.${String(cents).padStart(2, '0')}`;
}

export function toInputValue(minor: number | null | undefined): string {
  if (!minor) return '';
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}
