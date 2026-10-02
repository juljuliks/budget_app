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
  warning: '#fab219',
  critical: '#d03b3b',
};

export function seriesColor(colorRank: number): string {
  return chart.series[colorRank] ?? chart.other;
}
