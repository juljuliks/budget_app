// The plan's sections. Plain functions returning fragments, not components: StickyScrollView sticks the
// SectionHeaders it finds among its children and opened fragments only.
import React from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { SectionHeader } from '@/shared/ui/StickyScrollView';
import { formStyles } from '@/shared/theme/formStyles';
import { percentOf, PlanView } from '../model/planView';
import { FundItemRow } from './FundItemRow';
import { RecurringItemRow } from './RecurringItemRow';
import { SavingItemRow } from './SavingItemRow';
import { PlanItemRow, SystemRowView } from './PlanItemRow';
import { styles } from './styles';

const header = (title: string, total: React.ReactNode) => (
  <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
    <Text style={styles.groupTitle}>{title}</Text>
    {total}
  </SectionHeader>
);

type SystemOpen = {
  budget: () => void; carry: (kind: 'debt' | 'plus') => void; less: () => void; fund: (item: PlanItem) => void;
  /** a category's contributions to its repeating payments: its payments */
  saving: (item: PlanItem) => void;
};

/**
 * System "categories" first: what the budget sets apart before the plan — savings (locked, the funds' and the repeating
 * payments' contributions, floating) and the share outside the plan; like the plan's sections, with their share of the budget; a tap opens the
 * budget (a fund: the fund).
 */
export function systemSections(p: PlanView, hidden: boolean, open: SystemOpen) {
  return p.systemGroups.map((g) => {
    const funds = g.funds ?? [];
    const saving = g.saving ?? [];
    const sum = g.rows.reduce((a, r) => a + r.value, 0) + funds.reduce((a, i) => a + (i.converted_minor ?? 0), 0)
      + saving.reduce((a, i) => a + (i.subs?.saving_minor ?? 0), 0) - (funds.length ? p.less?.funds.less ?? 0 : 0);
    // the leftover moved in: on top of the budget, "+", no share
    const plus = g.rows.length > 0 && g.rows.every((r) => r.carry === 'plus');
    const row = (r: PlanView['systemGroups'][number]['rows'][number]) => (
      <SystemRowView key={r.key} p={p} r={r} hidden={hidden} onOpen={r.carry ? () => open.carry(r.carry!) : open.budget} onLess={open.less} />
    );
    return (
      <React.Fragment key={g.title}>
        {/* "Скрыть суммы": the share only */}
        {header(g.title, (
          <Text style={[styles.groupTotal, plus && styles.freeValue]}>
            {/* "(933 $) 2 425.98 ₾": the budget's currency first, when the screen shows another */}
            {hidden || g.inBudget === undefined || !p.budgetMoney ? null : <Text style={styles.groupForeign}>{`${p.budgetMoney(g.inBudget)} `}</Text>}
            {hidden && p.shownBudget ? null : `${plus ? '+' : ''}${p.money(sum)}`}
            {plus || !p.shownBudget ? null : <Text style={styles.groupShare}>{hidden ? '' : ' · '}{percentOf(sum, p.shownBudget) || '0%'}</Text>}
          </Text>
        ))}
        <View>
          {/* 🔒 first, then the funds and what is saved up for the repeating payments, then 💰 */}
          {g.rows.filter((r) => r.key === 'locked').map(row)}
          {funds.map((item) => <FundItemRow key={item.category_id} p={p} item={item} hidden={hidden} onOpen={() => open.fund(item)} onLess={open.less} />)}
          {saving.map((item) => <SavingItemRow key={item.category_id} p={p} item={item} hidden={hidden} onOpen={() => open.saving(item)} />)}
          {g.rows.filter((r) => r.key !== 'locked').map(row)}
        </View>
      </React.Fragment>
    );
  });
}

type Items = {
  ym: string; currency: Currency; hidden: boolean;
  toShown: (minor: number, from: Currency) => number | null;
  onOpen: (item: PlanItem) => void;
  /** a category with repeating payments: its payments */
  onOpenRecurring: (item: PlanItem) => void;
};

/** The plan's items by their category's type, each section with its total and its share of the budget; one with repeating payments — 🔁 for its icon. */
export function itemSections(p: PlanView, { ym, currency, hidden, toShown, onOpen, onOpenRecurring }: Items) {
  return p.groups.map((g) => (
    <React.Fragment key={g.title}>
      {/* the type's share of the amount to distribute; "Скрыть суммы": the share only */}
      {header(g.title, (
        <Text style={styles.groupTotal}>
          {hidden && p.shownBudget ? null : p.money(g.planned)}
          {p.shownBudget && g.planned ? <Text style={styles.groupShare}>{hidden ? '' : ' · '}{percentOf(g.planned, p.shownBudget)}</Text> : null}
        </Text>
      ))}
      <View>
        {g.items.map((item) => (item.recurring ? (
          <RecurringItemRow key={item.category_id} p={p} item={item} hidden={hidden} onOpen={() => onOpenRecurring(item)} />
        ) : (
          <PlanItemRow
            key={item.category_id} p={p} item={item} ym={ym} currency={currency} hidden={hidden} toShown={toShown}
            onOpen={() => onOpen(item)}
          />
        )))}
      </View>
    </React.Fragment>
  ));
}
