// The scales of the look (docs/refactor/components.md): text sizes by role, weights, spacing, radii. Styles take their
// numbers from here, not literals (REFACTOR_PLAN.md B2); colors — theme.ts.

/** text sizes by role */
export const font = {
  /** chart ticks, badges */
  micro: 10,
  /** small captions: «· 17:00» */
  caption: 12,
  /** a row's second line, hints, section bands */
  meta: 13,
  /** links and text buttons */
  secondary: 14,
  /** the main text of rows */
  body: 15,
  /** inputs, names in rows */
  input: 16,
  /** sheets' titles */
  title: 18,
  /** pages' titles */
  heading: 20,
  /** a block's big amount */
  headline: 24,
  /** the month's amount, the balance */
  display: 28,
  /** the report's stories */
  hero: 44,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** paddings, margins, gaps: `space[12]` */
export const space = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  48: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;
