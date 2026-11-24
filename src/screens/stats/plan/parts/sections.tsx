// The «План» tab's sections: the categories' plans by section. Plain functions returning fragments, not components:
// StickyScrollView sticks the SectionHeaders it finds among its children and opened fragments only.
import React from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { SectionHeader } from '@/shared/ui/StickyScrollView';
import { formStyles } from '@/shared/theme/formStyles';
import { percentOf, PlanView } from '../model/planView';
import { FundItemRow } from './FundItemRow';
import { RecurringItemRow } from './RecurringItemRow';
import { PlanItemRow } from './PlanItemRow';
import { styles } from './styles';

const header = (title: string, total: React.ReactNode) => (
  <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
    <Text style={styles.groupTitle}>{title}</Text>
    {total}
  </SectionHeader>
);

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

/** «Сбережения» in the plan: the funds (копилки), each with its goal and the month's contribution; a tap opens the fund. */
export function fundSection(p: PlanView, hidden: boolean, onOpen: (item: PlanItem) => void) {
  if (!p.funds.length) return null;
  const sum = p.funds.reduce((a, i) => a + (i.converted_minor ?? 0), 0);
  return (
    <React.Fragment key="funds">
      {header('Сбережения', (
        <Text style={styles.groupTotal}>
          {hidden && p.shownBudget ? null : p.money(sum)}
          {p.shownBudget && sum ? <Text style={styles.groupShare}>{hidden ? '' : ' · '}{percentOf(sum, p.shownBudget)}</Text> : null}
        </Text>
      ))}
      <View>
        {p.funds.map((item) => <FundItemRow key={item.category_id} p={p} item={item} hidden={hidden} onOpen={() => onOpen(item)} />)}
      </View>
    </React.Fragment>
  );
}
