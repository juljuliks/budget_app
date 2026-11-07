import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { currentYm, CategoryPlanKind } from '@/db/plans';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import RadioGroup from '@/shared/ui/RadioGroup';
import SectionHeading from '@/shared/ui/SectionHeading';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import type { CategoryKind } from '../model/useCategoryKind';
import type { KindData } from '../model/useKindData';
import { CHANGE, KIND_HINTS, KIND_OPTIONS, KIND_TITLE } from '../texts';

/** The regular payment's sheet starts from this month's item of it (its payment comes back in the sheet itself). */
function regularTarget(d: KindData, shown: PlanAmountTarget['currency']): PlanAmountTarget {
  const it = d.item;
  return {
    category_id: d.category.id, label: d.label, kind: 'subs', recurring: !!d.category.recurring, by_merchant: false,
    // this month's amount of it, whatever it was (the payment's own comes back in the sheet)
    limit_minor: it?.limit_minor ?? 0, currency: it?.currency ?? shown,
    every: it?.every ?? null, weekdays: it?.weekdays ?? null, unit_minor: it?.unit_minor ?? null, until: it?.every ? it.until : null,
  };
}

/**
 * A category's page: «В плане» — its kind (a limit, a regular payment, a one-off payment, a fund), what a new month
 * gets of it, what a set regular payment or fund is («650 $ · каждый месяц · Изменить ›»). A regular payment's
 * «Настроить» — the plan's sheet of it (its fields only); a fund's — the page passes it (`fundSetup`).
 */
export default function PlanKindSection({ k, fundSetup }: { k: CategoryKind; fundSetup: React.ReactNode }) {
  const shown = useDisplayCurrency();
  const d = k.data;
  if (!d) return null;
  const saved = d.category.plan_kind;
  const summary = k.picked === saved && (saved === 'regular' || saved === 'fund') ? d.summary : null;
  return (
    <View>
      <SectionHeading title={KIND_TITLE} />
      <RadioGroup<CategoryPlanKind> options={KIND_OPTIONS} value={k.picked as CategoryPlanKind} onChange={k.pick} />
      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{summary}</Text>
          <TextLink label={CHANGE} onPress={k.edit} />
        </View>
      ) : null}
      {k.picked ? <Text style={styles.hint}>{KIND_HINTS[k.picked]}</Text> : null}
      <PlanAmountModal
        ym={currentYm()} currency={shown} setup
        target={k.setup === 'regular' ? regularTarget(d, shown) : null}
        onClose={k.closeSetup} onSaved={k.setupSaved}
      />
      {fundSetup}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  summaryText: { fontSize: 15, color: colors.text, flexShrink: 1 },
  hint: { color: colors.muted, marginTop: 6, fontSize: 13, lineHeight: 18 },
});
