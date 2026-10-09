import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { useHideAmounts } from '@/hideAmounts';
import Fab from '@/shared/ui/Fab';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import { usePlanActions } from './model/usePlanActions';
import { usePlanData } from './model/usePlanData';
import { planView } from './model/planView';
import BudgetCard from './parts/BudgetCard';
import BudgetSheet from './parts/BudgetSheet';
import { itemSections, systemSections } from './parts/sections';
import { styles } from './parts/styles';
import PlanAddModal from './PlanAddModal';

/**
 * Plan for one month. A new month starts from the previous month's items:
 * pinned ones keep their amount, the others need a new amount (last month's is shown as a hint).
 * With an amount to distribute set, the plan can't exceed it; the rest is shown as "Свободно".
 * Every amount has the currency it was entered in; the screen shows them in `currency` (the switch on top of
 * the tab), with the original in brackets when it differs.
 */
export default function PlanView({ ym, currency }: { ym: string; currency: Currency }) {
  const hidden = useHideAmounts();
  const data = usePlanData(ym, currency);
  const { items, budget, toShown, load } = data;
  const actions = usePlanActions(ym, load);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanAmountTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (!items) return <View style={styles.center}><ActivityIndicator /></View>;
  const p = planView({ ...data, items, ym, currency, hidden });
  const openBudget = () => setBudgetOpen(true);

  return (
    <View style={styles.screen}>
    <StickyScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BudgetCard p={p} budget={budget} currency={currency} hidden={hidden} onEdit={openBudget} />
      <Text style={styles.pinNote}>📌 — переходит в следующий месяц с той же суммой</Text>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}
      {systemSections(p, hidden, openBudget)}
      {itemSections(p, {
        ym, currency, hidden, toShown,
        onOpen: (item) => setEditingItem({ ...item, label: categoryLabel(item) }),
        onPin: actions.togglePin,
      })}

      <BudgetSheet
        visible={budgetOpen} budget={budget} currency={currency} planned={p.total} hint={p.budgetHint} toShown={toShown}
        onSubmit={actions.saveBudget} onClose={() => setBudgetOpen(false)}
      />
      <PlanAmountModal
        ym={ym}
        currency={currency}
        target={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={load}
        onDelete={() => { const item = items.find((i) => i.category_id === editingItem?.category_id); if (item) actions.removeItem(item); }}
      />
    </StickyScrollView>
    {/* like the "+" on the transactions screen: several categories with amounts at once */}
    <Fab onPress={() => setAddOpen(true)} accessibilityLabel="Добавить категории в план" />
    <PlanAddModal ym={ym} currency={currency} visible={addOpen} plannedIds={items.map((i) => i.category_id)} onClose={() => setAddOpen(false)} onSaved={load} />
    </View>
  );
}
