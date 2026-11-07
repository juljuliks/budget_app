import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
import PlanIconsSheet from './parts/PlanIconsSheet';
import { InfoIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { itemSections, systemSections } from './parts/sections';
import { FundSheet } from '@/features/fund';
import { openCategory } from '@/shared/navigation/navigation';
import { PaymentsView, RecurringPaymentsSheet } from '@/features/recurring-payments';
import { CarrySheet } from '@/features/month-close';
import type { PlanItem } from '@/db/plans';
import { styles } from './parts/styles';
import PlanAddModal from './PlanAddModal';

/**
 * Plan for one month, the plan only (what is spent is the stats'). A new month starts from the previous month's items:
 * by each category's kind (a limit with its amount, a regular payment by its schedule, a one-off payment not at all).
 * With an amount to distribute set, the plan can't exceed it; the rest is shown as "Свободно".
 * Every amount has the currency it was entered in; the screen shows them in `currency` (the switch on top of
 * the tab), with the original in brackets when it differs.
 */
/** The plan sheet of an item (a fund's is its card: its category's page changes it). */
const editTarget = (item: PlanItem): PlanAmountTarget => ({ ...item, label: categoryLabel(item) });
/** «📺 Подписки» with subscriptions: always in the plan, not removed from it. */
const fixedSubs = (items: PlanItem[], id?: number) => items.some((i) => i.category_id === id && !!i.by_merchant && !!i.subs && !i.subs.empty);

export default function PlanView({ ym, currency }: { ym: string; currency: Currency }) {
  const hidden = useHideAmounts();
  const data = usePlanData(ym, currency);
  const { items, budget, toShown, load, storedCurrency } = data;
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
  // "Подписки" opened: the month's payments, or the coming ones ("Предстоящие подписки" in "Сбережения")
  const [subsOpen, setSubsOpen] = useState<{ item: PlanItem; view: PaymentsView } | null>(null);
  // "Что значат значки"
  const [iconsOpen, setIconsOpen] = useState(false);

  if (!items) return <Loading failed={data.failed} onRetry={load} />;
  const p = planView({ ...data, items, ym, currency, hidden });
  const openBudget = () => setBudgetOpen(true);

  // a category with regular payments: with "Подписки" — their list; else its own payment in the plan's sheet
  const openRecurring = (item: PlanItem, view: PaymentsView = 'month') => (item.by_merchant ? setSubsOpen({ item, view }) : setEditingItem(editTarget(item)));
  return (
    <View style={styles.screen}>
    <StickyScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BudgetCard p={p} budget={budget} currency={currency} hidden={hidden} onEdit={openBudget} />

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}
      {systemSections(p, hidden, { budget: openBudget, carry: setCarryOpen, fund: setFundOpen, saving: (item) => openRecurring(item, 'upcoming') })}
      {itemSections(p, {
        ym, currency, hidden, toShown,
        onOpen: (item) => setEditingItem(editTarget(item)),
        onOpenRecurring: (item) => openRecurring(item),
      })}
      {/* under every section: what the rows' icons mean */}
      <TouchableOpacity style={styles.iconsLink} onPress={() => setIconsOpen(true)} hitSlop={8} accessibilityRole="button">
        <InfoIcon color={colors.accent} size={16} />
        <Text style={styles.iconsLinkText}>Что значат значки</Text>
      </TouchableOpacity>

      <BudgetSheet
        visible={budgetOpen} budget={budget} currency={currency} defaultCurrency={storedCurrency}
        planned={p.claimed} hint={p.budgetHint} toShown={toShown}
        onSubmit={actions.saveBudget} onClose={() => setBudgetOpen(false)}
      />
      <PlanAmountModal
        ym={ym}
        currency={currency}
        target={editingItem}
        onClose={() => { setEditingItem(null); setAdding(false); }}
        onSaved={load}
        adding={adding ? { onBack: () => { setEditingItem(null); setAdding(false); setAddOpen(true); } } : undefined}
        // a fund is deleted from its card; «📺 Подписки» with subscriptions is always in the plan
        onDelete={adding || editingItem?.kind === 'fund' || fixedSubs(items, editingItem?.category_id) ? undefined
          : () => { const item = items.find((i) => i.category_id === editingItem?.category_id); if (item) actions.removeItem(item); }}
      />
      <FundSheet
        categoryId={fundOpen?.category_id ?? null}
        label={fundOpen ? `${fundOpen.emoji || ''} ${fundOpen.name}`.trim() : ''}
        ym={ym}
        onClose={() => setFundOpen(null)}
        onEdit={() => { const f = fundOpen; setFundOpen(null); if (f) openCategory(f.category_id); }}
      />
      {subsOpen ? (
        <RecurringPaymentsSheet
          ym={ym} category={{ id: subsOpen.item.category_id, name: subsOpen.item.name, emoji: subsOpen.item.emoji }} currency={currency}
          view={subsOpen.view} onClose={() => setSubsOpen(null)}
          onEditAmount={() => { const { item } = subsOpen; setSubsOpen(null); setEditingItem(editTarget(item)); }}
        />
      ) : null}
      <PlanIconsSheet visible={iconsOpen} onClose={() => setIconsOpen(false)} />
      <CarrySheet fromYm={carryOpen ? budget?.carry?.from_ym ?? null : null} kind={carryOpen ?? 'debt'} onClose={() => setCarryOpen(null)} />
    </StickyScrollView>
    {/* "Добавить в план": step 1 the category, step 2 its amount (the item's sheet) */}
    <Fab onPress={() => setAddOpen(true)} accessibilityLabel="Добавить в план" />
    <PlanAddModal ym={ym} currency={currency} visible={addOpen} onClose={() => setAddOpen(false)}
      onPick={(target) => { setAddOpen(false); setAdding(true); setEditingItem(target); }} />
    </View>
  );
}
