export const colors = {
  bg: '#FFFFFF',
  surface: '#F4F5F7',
  text: '#16181D',
  muted: '#6B7280',
  /** lighter than muted: a secondary amount next to the main one */
  faint: '#9CA3AF',
  border: '#E5E7EB',
  accent: '#2563EB',
  /** a light ground of the accent: a chip chosen softly (the moods) */
  accentBg: '#EFF6FF',
  /** text and icons on the accent color */
  onAccent: '#FFFFFF',
  income: '#15803D',
  warn: '#B45309',
  warnBg: '#FEF3C7',
  danger: '#B91C1C',
  /** a band of savings ("Сбережения" in the History) */
  savingsBg: '#ECFDF5',
  /** amounts going to savings ("Итоги месяца") */
  savingsText: '#0f766e',
  /** a rule between the lines of a savings block ("Итоги месяца") */
  savingsRule: '#CDEFE0',
  /** "Копилки": the funds' color, its light ground and the ring's track, its text */
  fund: '#7c3aed',
  fundBg: '#F5F3FF',
  fundTrack: '#EDE9FE',
  fundText: '#6D28D9',
  /** impulsive purchases: their share (orange; the considered ones — chart.meterFill), their amounts as text */
  impulse: '#F97316',
  impulseText: '#C2410C',
  /** a stronger light accent: a range's days in the calendar, a push's badge */
  accentSoft: '#DBEAFE',
  /** accent text on accentSoft */
  accentStrong: '#1D4ED8',
  /** text a step lighter than text: an example, a message's body */
  textSecondary: '#374151',
  /** an outline stronger than border: an option not chosen */
  borderStrong: '#D1D5DB',
  /** text on warnBg */
  warnText: '#92400E',
  /** an error's light ground (the error toast) */
  dangerBg: '#FEF2F2',
  /** a dark surface (the toast), its text and its accent */
  inverseBg: '#1F2937',
  onInverse: '#FFFFFF',
  inverseAccent: '#93C5FD',
  /** plain white and black for drawing: a switch's knob, a picker's gradients, a glyph on a colored circle */
  white: '#FFFFFF',
  black: '#000000',
  /** an emoji drawn as text: black, or Android tints it with the text color */
  emoji: '#000000',
  shadow: '#000000',
  /** a white glyph's shadow over a picture or a backdrop */
  textShadow: 'rgba(0,0,0,0.5)',
  /** under a sheet; under the long press's menu — lighter */
  backdrop: 'rgba(0,0,0,0.35)',
  backdropLight: 'rgba(22,24,29,0.28)',
  /** the D-pad's frosted plate */
  glassFill: 'rgba(255,255,255,0.62)',
  glassEdge: 'rgba(255,255,255,0.9)',
};

/** the roles marked in a bank message ("Не распознано"): a highlight's ground, its text, its underline */
export const markColors = {
  amount: { bg: '#DBEAFE', fg: '#1E3A8A', line: '#2563EB' },
  currency: { bg: '#FCE7F3', fg: '#831843', line: '#DB2777' },
  merchant: { bg: '#FFEDD5', fg: '#7C2D12', line: '#EA580C' },
  date: { bg: '#EDE9FE', fg: '#4C1D95', line: '#7C3AED' },
  balance: { bg: '#D1FAE5', fg: '#064E3B', line: '#059669' },
} as const;

// Chart colors. Category colors (palettes per type) live in src/domain/colors.ts.
export const chart = {
  track: '#f0efec',
  meterFill: '#2a78d6',
  meterTrack: '#cde2fb',
  critical: '#d03b3b',
  /** the month report's savings */
  savings: '#0d9488',
  /** the plan's ring: "Сбережения", 🔒 locked, the share outside the plan */
  ringSavings: '#5eead4',
  ringLocked: '#0f766e',
  ringUnplanned: '#eda100',
  /** spent / limit meter: green while far from the limit, turning red towards it (see meterColor) */
  meterStops: [
    [0, '#1baf7a'],
    [0.6, '#eda100'],
    [1, '#d03b3b'],
  ] as Array<[number, string]>,
};

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
  return `#${x
    .map((v, k) =>
      Math.round(v + (y[k] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
