import React from 'react';
import type { CategoryStat } from '@/db/plans';
import { GearIcon, ListIcon, PencilIcon, PlusIcon, TrendsIcon } from '@/shared/ui/icons';
import { monthDays } from '@/shared/lib/dateRange';
import { openCategory, openCategoryTrend, useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import type { PressAction } from '@/shared/ui/PressMenu';

type OpenTransactions = ReturnType<typeof useOpenCategoryTransactions>;

/** The texts of a row's menu buttons and of the hint under the month's total. */
export const ACTION_SPENDING = 'Операции';
export const ACTION_PLAN = 'План';
export const ACTION_TO_PLAN = 'В план';
export const ACTION_TREND = 'Динамика';
export const ACTION_CATEGORY = 'Категория';
export const ROW_MENU_HINT = 'Нажмите на категорию — операции, план, динамика, категория';

/**
 * A category's row's tap or long press: its operations of the month, its amount in the plan ("В план" without one), its
 * «Динамика», its page («Категория»). "Без категории" and a deleted one — the operations only.
 */
export function categoryActions(c: CategoryStat, open: { spending: () => void; plan: () => void; trend: () => void; category: () => void }): PressAction[] {
  const spending: PressAction = { key: 'spending', label: ACTION_SPENDING, icon: (color) => <ListIcon color={color} />, onPress: open.spending };
  if (c.category_id === null || c.deleted) return [spending];
  return [
    spending,
    c.limit_minor === null
      ? { key: 'plan', label: ACTION_TO_PLAN, icon: (color) => <PlusIcon color={color} />, onPress: open.plan }
      : { key: 'plan', label: ACTION_PLAN, icon: (color) => <PencilIcon color={color} size={22} />, onPress: open.plan },
    { key: 'category', label: ACTION_CATEGORY, icon: (color) => <GearIcon color={color} size={22} />, onPress: open.category },
    // a transfer: not spending, no «Динамика»; four — a cross: «Операции» left, «План» up, «Категория» right, «Динамика» down
    ...(c.transfer ? [] : [{ key: 'trend', label: ACTION_TREND, icon: (color: string) => <TrendsIcon color={color} />, onPress: open.trend }]),
  ];
}

/**
 * A fund's long press (in «Сбережения» or «Копилки»): its operations of the month, its sheet («План»), its «Динамика»,
 * its category's page («Категория»).
 */
export function fundActions(id: number, ym: string, openTransactions: OpenTransactions, openSheet: () => void): PressAction[] {
  return [
    { key: 'spending', label: ACTION_SPENDING, icon: (color) => <ListIcon color={color} />, onPress: () => openTransactions(id, monthDays(ym)) },
    { key: 'plan', label: ACTION_PLAN, icon: (color) => <PencilIcon color={color} size={22} />, onPress: openSheet },
    { key: 'category', label: ACTION_CATEGORY, icon: (color) => <GearIcon color={color} size={22} />, onPress: () => openCategory(id) },
    { key: 'trend', label: ACTION_TREND, icon: (color) => <TrendsIcon color={color} />, onPress: () => openCategoryTrend(id) },
  ];
}
