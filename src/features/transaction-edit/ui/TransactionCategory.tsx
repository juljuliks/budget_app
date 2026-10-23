import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { txCategoryLabel } from '@/db/categories';
import { EXPENSE_KINDS } from '@/db/spending';
import { CategoryLink, CategoryPickerModal } from '@/entities/category';
import { splitParts } from '@/entities/transaction';
import Chip from '@/shared/ui/Chip';
import SectionHeading from '@/shared/ui/SectionHeading';
import { PencilIcon } from '@/shared/ui/icons';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import type { Tx } from '../model/useTransaction';
import FundNote from './FundNote';
import SplitView from './SplitView';

type Cat = { id: number; label: string };

type Props = {
  tx: Tx;
  /** a merchant of different categories: its categories; taps toggle, one is saved, two open the split */
  mixedCats: Cat[] | null;
  /** the chips highlighted now */
  picked: number[];
  saving: boolean;
  choose: (categoryId: number | null) => void;
  onToggle: (id: number) => void;
  /** opens "Разделить по категориям"; ids — the categories a long press picked */
  onSplit: (ids?: number[]) => void;
};

/** The merchant's categories, plus the operation's own when it is not among them. */
function chipList(mixed: Cat[], categoryId: number | null, category: string | null): Cat[] {
  if (categoryId === null || !category || mixed.some((c) => c.id === categoryId)) return mixed;
  return [...mixed, { id: categoryId, label: category }];
}

/**
 * The operation's category. "Сменить" (right of "Категория") opens the category list; with none yet, the value is
 * "Без категории". A long press there picks several and opens the split. A merchant of different categories keeps its
 * chips: a tap highlights one (saved at once, "Готово" closes the page) or several ("Разделить" opens the split).
 * A refund keeps the chips. A split one shows its parts; a settled refund says so.
 */
export default function TransactionCategory({ tx, mixedCats, picked, saving, choose, onToggle, onSplit }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const category = txCategoryLabel(tx);
  const parts = splitParts(tx);
  const canSplit = [...EXPENSE_KINDS, 'refund'].includes(tx.kind);
  const change = (
    <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setPickerOpen(true)} accessibilityLabel="Сменить категорию">
      <PencilIcon color={colors.accent} size={16} />
      <Text style={styles.changeText}>Сменить</Text>
    </TouchableOpacity>
  );

  if (tx.refund_settled_at) return <Text style={styles.refundDone}>✓ Возврат учтён в покупке</Text>;
  if (parts) return <SplitView parts={parts} total={tx.amount_minor} currency={tx.currency} onEdit={() => onSplit()} />;
  return (
    <>
      <SectionHeading title="Категория" right={change} />
      {mixedCats?.length ? (
        <MixedChips tx={tx} mixed={mixedCats} category={category} picked={picked} saving={saving} onToggle={onToggle} />
      ) : tx.category_id !== null && category ? (
        <CategoryLink categoryId={tx.category_id} label={category} style={styles.catName} containerStyle={styles.catLink} />
      ) : (
        <Text style={styles.none}>{NO_CATEGORY}</Text>
      )}
      {category || mixedCats?.length ? (
        <FundNote txId={tx.id} categoryId={tx.category_id} merchantKey={tx.merchant_key} occurredAt={tx.occurred_at} amount={tx.amount_minor} />
      ) : null}
      <CategoryPickerModal
        visible={pickerOpen}
        title="Сменить категорию"
        selectedId={tx.category_id}
        transferFirst={tx.kind === 'transfer'}
        deposit={tx.kind === 'deposit'}
        allowNone
        onPick={(id) => { setPickerOpen(false); choose(id); }}
        onSeveral={canSplit ? (ids) => { setPickerOpen(false); onSplit(ids); } : undefined}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

/** Chips of a merchant of different categories: a tap highlights, and does not leave the page. */
function MixedChips({ tx, mixed, category, picked, saving, onToggle }: {
  tx: Tx; mixed: Cat[]; category: string | null; picked: number[]; saving: boolean; onToggle: (id: number) => void;
}) {
  const chips = chipList(mixed, tx.category_id, category);
  return (
    <View style={styles.currentRow}>
      {chips.map((c) => (
        <Chip key={c.id} label={c.label} selected={picked.includes(c.id)} disabled={saving} onPress={() => onToggle(c.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  catLink: { flex: 1, minWidth: 0, paddingVertical: 8 },
  catName: { fontSize: 18 },
  none: { fontSize: 18, color: colors.text, paddingVertical: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  refundDone: { fontSize: 15, color: colors.income, fontWeight: '600' },
});
