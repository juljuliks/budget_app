import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Loading from '@/shared/ui/Loading';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import Fab from '@/shared/ui/Fab';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import { usePlanActions } from './model/usePlanActions';
import { usePlanData } from './model/usePlanData';
import { planView } from './model/planView';
import BudgetCard from './parts/BudgetCard';
import BudgetSheet from './parts/BudgetSheet';
import SavingsLessSheet from './parts/SavingsLessSheet';
import { itemSections, systemSections } from './parts/sections';
import { FundSheet } from '@/features/fund';
import { RecurringPaymentsSheet } from '@/features/recurring-payments';
import { CarrySheet } from '@/features/month-close';
import type { PlanItem } from '@/db/plans';
import { styles } from './parts/styles';
import PlanAddModal from './PlanAddModal';

/**
 * Plan for one month. A new month starts from the previous month's items:
 * pinned ones keep their amount, the others need a new amount (last month's is shown as a hint).
 * With an amount to distribute set, the plan can't exceed it; the rest is shown as "Свободно".
 * Every amount has the currency it was entered in; the screen shows them in `currency` (the switch on top of
 * the tab), with the original in brackets when it differs.
 */
/** The plan sheet of an item: a fund with its target, date and what was saved before. */
const editTarget = (item: PlanItem): PlanAmountTarget => ({
  ...item, label: categoryLabel(item),
  fund: item.fund && { target_minor: item.fund.target_minor, due: item.fund.due, start_minor: item.fund.start_minor },
  merchants: !!item.recurring && !item.subs?.own,
});

export default function PlanView({ ym, currency }: { ym: string; currency: Currency }) {
  const hidden = useHideAmounts();
  const data = usePlanData(ym, currency);
  const { items, budget, toShown, load } = data;
  const actions = usePlanActions(ym, load);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanAmountTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // the item's sheet is step 2 of "Добавить в план" (the category picked in step 1)
  const [adding, setAdding] = useState(false);
  // the fund opened (its card): the category
  const [fundOpen, setFundOpen] = useState<PlanItem | null>(null);
  // what the month before sent, opened: its overspend or its leftover
  const [carryOpen, setCarryOpen] = useState<'debt' | 'plus' | null>(null);
  // ⓘ of the savings the overspend took part of
  const [lessOpen, setLessOpen] = useState(false);
  // "Подписки" opened
  const [subsOpen, setSubsOpen] = useState<PlanItem | null>(null);

  if (!items) return <Loading failed={data.failed} onRetry={load} />;
  const p = planView({ ...data, items, ym, currency, hidden });
  const openBudget = () => setBudgetOpen(true);

  // a category with repeating payments: its own payment (from the plan's sheet) — that sheet; the merchants' ones — their list
  const openRecurring = (item: PlanItem) => (item.subs?.own ? setEditingItem(editTarget(item)) : setSubsOpen(item));
  return (
    <View style={styles.screen}>
    <StickyScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BudgetCard p={p} budget={budget} currency={currency} hidden={hidden} onEdit={openBudget} onLess={() => setLessOpen(true)} />
      <Text style={styles.pinNote}>{`📌 — переходит в следующий месяц с той же суммой${p.recurring.length ? '\n🔁 — повторяющийся платёж: переходит всегда, сумма — по датам списаний' : ''}`}</Text>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}
      {systemSections(p, hidden, { budget: openBudget, carry: setCarryOpen, less: () => setLessOpen(true), fund: setFundOpen, saving: openRecurring })}
      {itemSections(p, {
        ym, currency, hidden, toShown,
        onOpen: (item) => setEditingItem(editTarget(item)),
        onPin: actions.togglePin,
        onOpenRecurring: openRecurring,
      })}

      <BudgetSheet
        visible={budgetOpen} budget={budget} currency={currency} planned={p.claimed} hint={p.budgetHint} toShown={toShown}
        onSubmit={actions.saveBudget} onClose={() => setBudgetOpen(false)}
      />
      <PlanAmountModal
        ym={ym}
        currency={currency}
        target={editingItem}
        onClose={() => { setEditingItem(null); setAdding(false); }}
        onSaved={load}
        adding={adding ? { onBack: () => { setEditingItem(null); setAdding(false); setAddOpen(true); } } : undefined}
        // a fund is deleted from its card
        onDelete={adding || editingItem?.kind === 'fund' ? undefined : () => { const item = items.find((i) => i.category_id === editingItem?.category_id); if (item) actions.removeItem(item); }}
      />
      <FundSheet
        categoryId={fundOpen?.category_id ?? null}
        label={fundOpen ? `${fundOpen.emoji || ''} ${fundOpen.name}`.trim() : ''}
        onClose={() => setFundOpen(null)}
        onEdit={() => { const f = fundOpen; setFundOpen(null); if (f) setEditingItem(editTarget(f)); }}
      />
      <SavingsLessSheet
        less={p.less} visible={lessOpen} money={p.money} onClose={() => setLessOpen(false)}
        onOpen={(id) => { const item = items.find((i) => i.category_id === id); if (item) setEditingItem(editTarget(item)); }}
      />
      {subsOpen ? (
        <RecurringPaymentsSheet
          ym={ym} category={{ id: subsOpen.category_id, name: subsOpen.name, emoji: subsOpen.emoji }} currency={currency}
          onClose={() => setSubsOpen(null)}
          onEditAmount={() => { const item = subsOpen; setSubsOpen(null); setEditingItem(editTarget(item)); }}
        />
      ) : null}
      <CarrySheet fromYm={carryOpen ? budget?.carry?.from_ym ?? null : null} kind={carryOpen ?? 'debt'} onClose={() => setCarryOpen(null)} />
    </StickyScrollView>
    {/* "Добавить в план": step 1 the category, step 2 its amount (the item's sheet) */}
    <Fab onPress={() => setAddOpen(true)} accessibilityLabel="Добавить в план" />
    <PlanAddModal ym={ym} currency={currency} visible={addOpen} onClose={() => setAddOpen(false)}
      onPick={(target) => { setAddOpen(false); setAdding(true); setEditingItem(target); }} />
    </View>
  );
}
