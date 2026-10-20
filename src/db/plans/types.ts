// The plan's types: an item, the month's budget, the kinds and the spending rhythms.
import { Currency } from '../fx';
import type { Period } from '../recurring/schedule';

/**
 * 'limit' = spending cap (progress bar); 'fixed' = a one-off payment, a known amount ("Разовый платёж": a gift; paid / not paid); 'fund' = a fund's contribution
 * (funds.ts); 'subs' = a category with "Регулярные платежи", the month's charges (recurringItems.ts).
 */
export type PlanKind = 'limit' | 'fixed' | 'fund' | 'subs';

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
  /** the category's system kind, null / absent for the user's own */
  system?: string | null;
  /** "Регулярные платежи" on: its item counted from its payments */
  recurring?: boolean;
  /** with repeating payments: those charged by name, those saved up for, their contributions in the plan's currency */
  subs?: {
    names: string[]; saving_names: string[];
    /** the month's contributions (in "Сбережения" of the plan), what is saved by the month's end and for how much (its ring) */
    saving_minor: number; saving_end_minor: number; saving_amount_minor: number;
    /** none at all ("Подписки" without subscriptions) */
    empty?: boolean;
    /** all its payments in one currency: the month's charges and contributions in it */
    in_currency?: { currency: Currency; charges_minor: number; saving_minor: number };
    /** none charged this month: its next charge, in a coming month — its amount in its currency and the month */
    upcoming?: { amount_minor: number; currency: Currency; ym: string };
    /** the category's only payment: how often, its charge this month (done) or the next one; day null — none set */
    single?: { period: Period; day: string | null; done: boolean };
  };
  /** a fund's item (kind 'fund'): how much by when, what it has by the month's end (now, for the current one); in `currency` */
  fund?: { target_minor: number; due: string; saved_minor: number; start_minor: number };
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
  /** what the month before sent ("Итоги месяца"), in the budget's currency: owed, moved in; in `plannable_minor` */
  carry: { from_ym: string; debt_minor: number; plus_minor: number } | null;
};
