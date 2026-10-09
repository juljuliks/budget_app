import type { Currency } from '@/db/fx';

/** The budget sheet: the amount and its currency, the parts the plan can't take, where the leftover goes. */
export type BudgetForm = { value: string; currency: Currency; toSavings: boolean; locked: string; unplanned: string };

/** the slider's stops, % of the budget */
export const SHARE_STOPS = [0, 10, 20, 30, 40, 50];
