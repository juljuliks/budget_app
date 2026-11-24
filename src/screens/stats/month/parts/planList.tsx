// The «План» tab under the ring: the month's plans by category, by section, and «Сбережения» — 🔒 locked right away and the funds; no spending. A plain function returning a
// fragment (StickyScrollView sticks the sections' headers it finds among its children and fragments).
import React from 'react';
import { Text } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { fundSection, itemSections } from '../../plan/parts/sections';
import { styles } from './styles';
import type { usePlanSheets } from './usePlanSheets';

type Open = {
  /** a category with «Подписки» on: their list */
  subs: (item: PlanItem) => void;
  /** a fund: its card */
  fund: (item: PlanItem) => void;
};

export function planList(plan: ReturnType<typeof usePlanSheets>, ym: string, currency: Currency, open: Open) {
  const { p } = plan;
  if (!p) return null;
  const amount = (item: PlanItem) => plan.openAmount({ ...item, label: categoryLabel(item) });
  if (p.groups.length === 0 && !p.funds.length && !p.locked)
    return <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text>;
  return (
    <>
      {itemSections(p, {
        ym,
        currency,
        hidden: p.hidden,
        toShown: plan.toShown,
        onOpen: amount,
        // a category with repeating payments: with «Подписки» — their list; else its own payment in the amount's sheet
        onOpenRecurring: (item) => (item.by_merchant ? open.subs(item) : amount(item)),
      })}
      {fundSection(p, p.hidden, { budget: plan.openBudget, fund: open.fund })}
    </>
  );
}
