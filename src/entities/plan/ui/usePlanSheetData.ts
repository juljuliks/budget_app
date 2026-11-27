// The plan sheet's facts: what is free, 🔒, last month's item, the usual and this month's spending, its payment.
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import {
  categoryMonthlyAverage,
  categoryMonthSpent,
  categoryPlanKind,
  currentYm,
  getPlanBudget,
  getPlanItemBasics,
  itemDue,
  lastPlanItem,
  type NormPeriod,
  type PlanKind,
  planConverter,
  plannedTotal,
} from '@/db/plans';
import { categoryPayment, paymentsOfCategory } from '@/db/recurring';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { toInputValue } from '@/shared/lib/money';
import { toastFailure } from '@/shared/ui/toast';
import type { DueForm } from './OneOffDueField';
import type { RegularForm } from './RegularFields';
import type { PlanAmountTarget } from './PlanAmountModal';
import { itemKindOf } from './sheetOptions';

export type PlanSheetForm = RegularForm &
  DueForm & { value: string; currency: Currency; kind: PlanKind; norm: NormPeriod };

/** A one-off payment's day in the form: as its default (nothing changed) and as what it shows. */
function setDue(form: UseFormReturn<DueForm>, due: string | null) {
  form.resetField('due', { defaultValue: due });
  form.setValue('due', due);
}

/**
 * Loads what the sheet shows over the field and sets the form's fields that come from elsewhere: its payment's period,
 * its end and next day, a one-off payment's day; not in the plan yet — the amount offered, the kind and how it is spent.
 */
export function usePlanSheetData(
  ym: string,
  target: PlanAmountTarget | null,
  form: UseFormReturn<PlanSheetForm>,
  shown: Currency,
  setup?: boolean,
) {
  // the most this category can get = amount to distribute − the other categories (null = no amount set), in the app's currency
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // "🔒 Отложить сразу", in the budget's currency: what is short of free can be taken from it
  const [locked, setLocked] = useState(0);
  const [previous, setPrevious] = useState<{ minor: number; currency: Currency; ym: string } | null>(null);
  // what the category usually takes a month (the latest full months), in the app's currency
  const [average, setAverage] = useState<{ minor: number; months: number; from: string; to: string } | null>(null);
  // what the category spent in the month so far (not in a coming one), in the app's currency
  const [spent, setSpent] = useState<{ minor: number; ym: string } | null>(null);
  // the item in the month's plan already; the category's own payment's period (null — none)
  const [inPlan, setInPlan] = useState(true);
  const [ownPeriod, setOwnPeriod] = useState<number | null>(null);
  // the latest month's amount of it (in its currency): «Настроить» of a monthly payment without this month's keeps it
  const [lastAmount, setLastAmount] = useState(0);
  // a category with "Подписки": has it subscriptions (off in the plan — they count again)
  const [hasSubs, setHasSubs] = useState(false);
  useEffect(() => {
    if (!target?.by_merchant) {
      setHasSubs(false);
      return;
    }
    paymentsOfCategory(target.category_id)
      .then((all) => setHasSubs(all.some((p) => p.merchant_key)))
      .catch(toastFailure('load subscriptions', LOAD_FAILED));
  }, [target]);

  useEffect(() => {
    if (!target) return;
    (async () => {
      const [budget, last, conv, avg, spentMinor, own, item, payment] = await Promise.all([
        getPlanBudget(ym),
        lastPlanItem(ym, target.category_id),
        planConverter(ym),
        categoryMonthlyAverage(target.category_id, ym, shown),
        ym > currentYm() ? null : categoryMonthSpent(target.category_id, ym, shown),
        categoryPlanKind(target.category_id),
        getPlanItemBasics(ym, target.category_id),
        target.every || target.by_merchant ? null : categoryPayment(target.category_id),
      ]);
      // a one-off payment's day in the month
      // its default and its value: reopened (the sheet kept mounted), the field shows it, not the reset's null
      if (item?.kind === 'fixed' && !item.every)
        setDue(form as unknown as UseFormReturn<DueForm>, await itemDue(ym, target.category_id));
      setInPlan(!!item);
      setOwnPeriod(payment?.period ?? null);
      // its own payment, how often and its end (the sheet saves them back as they are)
      if (payment && !setup) {
        form.setValue('period', payment.period);
        form.setValue('until', payment.until);
        form.resetField('next', { defaultValue: payment.due });
        form.setValue('next', payment.due);
      }
      const others = budget ? await plannedTotal(ym, target.category_id, budget.currency) : 0;
      // in the app's currency; the original one when there is no rate
      const inShown = (minor: number, from: Currency) => {
        const c = conv(minor, from, shown);
        return c === null ? { minor, currency: from } : { minor: c, currency: shown };
      };
      // the unplanned share is not for the plan
      setFree(budget ? inShown(Math.max(budget.plannable_minor - others, 0), budget.currency) : null);
      setLocked(budget?.locked_minor ?? 0);
      setPrevious(last ? { ...inShown(last.limit_minor, last.currency), ym: last.ym } : null);
      setAverage(
        avg && avg.average_minor > 0
          ? { minor: avg.average_minor, months: avg.months, from: avg.from, to: avg.to }
          : null,
      );
      setSpent(spentMinor === null ? null : { minor: spentMinor, ym });
      setLastAmount(last?.limit_minor ?? 0);
      if (setup && !target.limit_minor && !target.every && last) form.setValue('currency', last.currency);
      if (setup) return;
      // not in the plan yet: the amount it was opened with (what the category spent), else last month's item —
      // ready to save as is (so it counts as a change); the kind and pattern from last month either way
      const dirty = { shouldDirty: true };
      if (!target.limit_minor && target.suggested_minor) {
        form.setValue('value', toInputValue(target.suggested_minor), dirty);
        form.setValue('currency', target.currency, dirty);
      } else if (!target.limit_minor && last) {
        form.setValue('value', toInputValue(last.limit_minor), dirty);
        form.setValue('currency', last.currency, dirty);
      }
      // not in the plan: the item as its category's kind says (none set — a one-off payment)
      if (!item && !target.by_merchant) form.setValue('kind', itemKindOf(own), dirty);
      if (!target.limit_minor && last && !target.norm_period) form.setValue('norm', last.norm_period, dirty);
    })().catch(toastFailure('load plan budget', LOAD_FAILED));
  }, [ym, target, form, shown, setup]);

  return { free, locked, previous, average, spent, inPlan, ownPeriod, lastAmount, hasSubs };
}
