export const colors = {
  bg: '#FFFFFF',
  surface: '#F4F5F7',
  text: '#16181D',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#2563EB',
  income: '#15803D',
  warn: '#B45309',
  warnBg: '#FEF3C7',
  danger: '#B91C1C',
};

// Chart colors (dataviz reference palette, validated for CVD on a white surface).
// Slots are assigned by a category's all-time spend rank so colors stay stable across months.
export const chart = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  other: '#c3c2b7', // folded "Другое" + uncategorized
  track: '#f0efec',
  meterFill: '#2a78d6',
  meterTrack: '#cde2fb',
  critical: '#d03b3b',
  /** spent / limit meter: green while far from the limit, turning red towards it (see meterColor) */
  meterStops: [[0, '#1baf7a'], [0.6, '#eda100'], [1, '#d03b3b']] as Array<[number, string]>,
};

export function seriesColor(colorRank: number): string {
  return chart.series[colorRank] ?? chart.other;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Spent / limit: a smooth green -> amber -> red blend by how close the spend is to the limit; red at and over it. */
export function meterColor(ratio: number): string {
  const stops = chart.meterStops;
  if (ratio >= 1) return chart.critical;
  if (ratio <= 0) return stops[0][1];
  const i = stops.findIndex(([at]) => at >= ratio);
  const [a, ca] = stops[i - 1];
  const [b, cb] = stops[i];
  const t = (ratio - a) / (b - a);
  const [x, y] = [rgb(ca), rgb(cb)];
  return `#${x.map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
