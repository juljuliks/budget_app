import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import { categoryColors } from '@/db/colors';
import { Currency } from '@/db/fx';
import { AddableCategory, AddableGroup, addableCategories, getPlanBudget, parseYm, plannedTotal } from '@/db/plans';
import type { PlanAmountTarget } from '@/entities/plan';
import { MONTHS_GEN, MONTHS_NOM, MONTHS_PREP } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import SearchBar from '@/shared/ui/SearchBar';
import StepsNav from '@/shared/ui/StepsNav';
import { toastFailure } from '@/shared/ui/toast';
import { font, radius, space } from '@/shared/theme/tokens';
import Empty from '@/shared/ui/Empty';

type Props = {
  ym: string;
  /** the screen's currency: what is spent is shown in it, a new item starts in it */
  currency: Currency;
  visible: boolean;
  onClose: () => void;
  /** the category picked: step 2, its amount (PlanAmountModal) */
  onPick: (target: PlanAmountTarget) => void;
};

/**
 * "＋" on the plan, step 1 of "Добавить в план": the categories not in the plan — those of the month before's plan
 * (its amount, what is spent in this one), then those spent in this month, then the rest. A tap goes to the amount.
 */
export default function PlanAddModal({ ym, currency, visible, onClose, onPick }: Props) {
  const [rows, setRows] = useState<AddableCategory[] | null>(null);
  const [colorOf, setColorOf] = useState<Map<number, string>>(new Map());
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    (async () => {
      const [list, colorMap, budget] = await Promise.all([
        addableCategories(ym, currency),
        categoryColors(),
        getPlanBudget(ym),
      ]);
      setRows(list);
      setColorOf(colorMap);
      setFree(
        budget && {
          minor: Math.max(budget.plannable_minor - (await plannedTotal(ym, undefined, budget.currency)), 0),
          currency: budget.currency,
        },
      );
    })().catch(toastFailure('load plan categories', LOAD_FAILED));
  }, [visible, ym, currency]);

  const { year, month } = parseYm(ym);
  const titles: Record<AddableGroup, string> = {
    last: `В плане ${MONTHS_GEN[(month + 11) % 12]}`,
    spent: `С тратами в ${MONTHS_PREP[month]}`,
    other: 'Остальные',
  };
  const money = (minor: number, c: Currency = currency) => formatWithCurrency(minor, c);
  const note = (c: AddableCategory) =>
    c.last
      ? `план ${money(c.last.limit_minor, c.last.currency)} · ${c.spent_minor > 0 ? `потрачено ${money(c.spent_minor)}` : 'трат нет'}`
      : c.spent_minor > 0
        ? `потрачено ${money(c.spent_minor)}`
        : null;
  const pick = (c: AddableCategory) =>
    onPick({ category_id: c.id, label: categoryLabel(c), limit_minor: 0, currency: c.last?.currency ?? currency });

  const q = query.toLowerCase();
  const filtered = q ? (rows ?? []).filter((c) => categoryLabel(c).toLowerCase().includes(q)) : (rows ?? []);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Добавить в план" style={styles.sheet}>
      <StepsNav at={0} count={2} name="Категория" style={styles.inset} />
      <Text style={styles.caption}>
        {`${free ? `Свободно: ${money(free.minor, free.currency)}` : 'Бюджет месяца не задан'} · траты — за ${MONTHS_NOM[month]}${year !== new Date().getFullYear() ? ` ${year}` : ''}`}
      </Text>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChange={setQuery} placeholder="Найти категорию" />
      </View>
      <SheetScrollView keyboardShouldPersistTaps="handled">
        {filtered.map((c, i, all) => (
          <View key={c.id}>
            {!q && (i === 0 || all[i - 1].group !== c.group) ? (
              <Text style={formStyles.sectionHeader}>{titles[c.group]}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.row}
              onPress={() => pick(c)}
              accessibilityRole="button"
              accessibilityLabel={`Добавить в план: ${categoryLabel(c)}`}
            >
              <View style={[styles.dot, { backgroundColor: colorOf.get(c.id) ?? colors.border }]} />
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {categoryLabel(c)}
                </Text>
                {note(c) ? <Text style={styles.note}>{note(c)}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        ))}
        {rows?.length === 0 ? <Empty compact>Все категории уже в плане.</Empty> : null}
        {rows !== null && rows.length > 0 && q && filtered.length === 0 ? <Empty compact>Не найдено.</Empty> : null}
      </SheetScrollView>
      <SheetActions submit={null} onCancel={onClose} style={styles.actions} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  inset: { paddingHorizontal: space[20] },
  caption: { fontSize: font.meta, color: colors.muted, paddingHorizontal: space[20], paddingBottom: space[8] },
  searchWrap: { paddingHorizontal: space[16], paddingBottom: space[8] },
  // as in "Настройки → Категории"
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space[16],
    paddingRight: space[8],
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: radius.pill, marginRight: space[10] },
  text: { flex: 1, gap: space[2] },
  name: { fontSize: font.input, color: colors.text },
  note: { fontSize: font.meta, color: colors.muted },
  chevron: { fontSize: font.headline, color: colors.muted, marginLeft: space[8] },
  actions: { paddingHorizontal: space[16], marginTop: space[8] },
});
