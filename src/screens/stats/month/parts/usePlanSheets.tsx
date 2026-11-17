// The month's plan, changed from the stats (there is no plan page): its budget, a category added («＋»), an amount
// changed or removed, what the month before sent. The sheets as one element, opened by what the hook returns.
import React, { useState } from 'react';
import type { Currency } from '@/db/fx';
import { getPlanItemBasics, PlanItem } from '@/db/plans';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { paymentWords } from '@/entities/category';
import { CarrySheet } from '@/features/month-close';
import { inTime, shortDay } from '@/features/recurring-payments';
import { emitTransactionsChanged } from '@/domain/events';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { planView } from '../../plan/model/planView';
import { usePlanActions } from '../../plan/model/usePlanActions';
import { usePlanData } from '../../plan/model/usePlanData';
import BudgetSheet from '../../plan/parts/BudgetSheet';
import { recurringNotes } from '../model/recurringNote';
import PlanAddModal from './PlanAddModal';
import type { ShareBase } from './sections';

/** «📺 Подписки» with subscriptions: always in the plan, not removed from it. */
const fixedSubs = (items: PlanItem[], id?: number) => items.some((i) => i.category_id === id && !!i.by_merchant && !!i.subs && !i.subs.empty);

export function usePlanSheets(ym: string, currency: Currency) {
  const hidden = useHideAmounts();
  const data = usePlanData(ym, currency);
  const { items, budget, toShown, storedCurrency } = data;
  // the stats, their «Сбережения» and this plan: all reload
  const reload = () => emitTransactionsChanged();
  const actions = usePlanActions(ym, reload);
  const [target, setTarget] = useState<PlanAmountTarget | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // the amount's sheet is step 2 of "Добавить в план" (the category picked in step 1)
  const [adding, setAdding] = useState(false);
  // what the month before sent, opened: its overspend or its leftover
  const [carry, setCarry] = useState<'debt' | 'plus' | null>(null);
  const p = items ? planView({ ...data, items, ym, currency, hidden }) : null;
  const item = items?.find((i) => i.category_id === target?.category_id);

  const sheets = (
    <>
      {p ? (
        <BudgetSheet
          visible={budgetOpen} budget={budget} currency={currency} defaultCurrency={storedCurrency}
          planned={p.claimed} hint={p.budgetHint} toShown={toShown}
          onSubmit={actions.saveBudget} onClose={() => setBudgetOpen(false)}
        />
      ) : null}
      <PlanAddModal ym={ym} currency={currency} visible={addOpen} onClose={() => setAddOpen(false)}
        onPick={(t) => { setAddOpen(false); setAdding(true); setTarget(t); }} />
      <PlanAmountModal
        ym={ym}
        currency={currency}
        target={target}
        onClose={() => { setTarget(null); setAdding(false); }}
        onSaved={reload}
        adding={adding ? { onBack: () => { setTarget(null); setAdding(false); setAddOpen(true); } } : undefined}
        // a fund is deleted from its card; «📺 Подписки» with subscriptions is always in the plan
        onDelete={adding || !item || item.kind === 'fund' || fixedSubs(items ?? [], item.category_id) ? undefined
          : () => { actions.removeItem(item).catch((e) => console.error('remove plan item failed', e)); }}
      />
      <CarrySheet fromYm={carry ? budget?.carry?.from_ym ?? null : null} kind={carry ?? 'debt'} onClose={() => setCarry(null)} />
    </>
  );

  return {
    /** the plan worked out (null — loading): the budget, the carry, each section's share */
    p,
    /** under a category with repeating payments: what they are */
    notes: p ? recurringNotes(p.recurring, currency, p.timing === 'current', { words: paymentWords, shortDay: (d) => shortDay(d), inTime }) : new Map<number, string>(),
    /** a category's payments charged this month and how many are done */
    charges: new Map((p?.recurring ?? []).filter((i) => i.subs?.charges).map((i) => [i.category_id, i.subs!.charges!])),
    sheets,
    /** what a section's share is of: the budget («35% бюджета»), without one — the whole plan («· 45% плана») */
    shareBase: (plannedAll: number): ShareBase => (p?.shownBudget ? { minor: p.shownBudget, word: 'бюджета' } : { minor: plannedAll, word: 'плана' }),
    openBudget: () => setBudgetOpen(true),
    openAdd: () => setAddOpen(true),
    openAmount: setTarget,
    openCarry: setCarry,
    /** a category's amount in the plan, from a sheet over the stats (`close` it first) */
    openItem: async (id: number, label: string, close: () => void) => {
      const basics = await getPlanItemBasics(ym, id);
      if (basics) { close(); setTarget({ category_id: id, label, ...basics }); }
    },
  };
}
