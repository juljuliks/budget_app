// The plan's colors and the budget bar's sizes.
import { chart, colors } from '@/shared/theme/theme';

/** "Сбережения" in place of "Свободно" */
export const RING_SAVINGS = '#5eead4';
/** 🔒 locked for savings: the darker part of the savings */
export const RING_LOCKED = '#0f766e';
/** the funds' contributions ("Копилки") */
export const RING_FUNDS = colors.fund;
/** an overspend the month before left to this one */
export const RING_DEBT = chart.critical;
/** the share set aside for spending outside the plan */
export const RING_UNPLANNED = '#eda100';
/** the budget's bar, and the 🔒 over its locked part: twice as tall */
export const BAR_HEIGHT = 12;
export const LOCK_BADGE = BAR_HEIGHT * 2;
/** the 🔒 badge's size of the locked part's width, and the smallest worth drawing */
export const LOCK_SHARE = 0.6;
export const LOCK_MIN = 10;
