// The plan's types: an item, the month's budget, the kinds and the spending rhythms.
import { Currency } from '../fx';

/** 'limit' = spending cap (progress bar); 'fixed' = fixed payment like rent (paid / not paid). */
export type PlanKind = 'limit' | 'fixed';

/**
 * The rhythm a flexible item's norm is counted in for period stats: food every day, bars per week, clothes per
 * month. The norm of a window is the month's plan / days in the month × days of the window ('month' = the plan).
 */
export type NormPeriod = 'day' | 'week' | '2weeks' | 'month';

export const NORM_PERIODS: NormPeriod[] = ['day', 'week', '2weeks', 'month'];

export const asNorm = (v: string | null | undefined): NormPeriod => (NORM_PERIODS.includes(v as NormPeriod) ? (v as NormPeriod) : 'day');

export type PlanItem = {
  category_id: number;
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  /** 0 = amount not set yet this month; in `currency` */
  limit_minor: number;
  currency: Currency;
  /** limit_minor converted (to the currency asked for in listPlan); null without a rate */
  converted_minor: number | null;
  kind: PlanKind;
  norm_period: NormPeriod;
  pinned: boolean;
  /** amount of the same item in the month this plan was carried over from (placeholder hint) */
  previous_minor: number | null;
};

/** The month's amount to distribute and its currency. */
export type PlanBudget = {
  amount_minor: number;
  currency: Currency;
  /** the share set aside for spending outside the plan, 0–50 (%) */
  unplanned_pct: number;
  /** that share as an amount of one's own, in the budget's currency (instead of the %); null = by the % */
  unplanned_minor: number | null;
  /** locked for savings right away (🔒), in the budget's currency */
  locked_minor: number;
  /** what the plan can take: the amount minus the unplanned share and the locked savings */
  plannable_minor: number;
  /** what the budget leaves (not planned, not spent) goes to "Сбережения" */
  to_savings: boolean;
};
