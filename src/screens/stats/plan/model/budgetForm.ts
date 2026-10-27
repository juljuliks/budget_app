import type { Currency } from '@/db/fx';

/** The budget sheet: the amount and its currency, the parts the plan can't take, (where the leftover goes: "Итоги месяца"). */
export type BudgetForm = { value: string; currency: Currency; locked: string; unplanned: string; lockedIsMax: boolean };

/** the slider's stops, % of the budget */
export const SHARE_STOPS = [0, 10, 20, 30, 40, 50];
