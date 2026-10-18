import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { txCategoryLabel } from '@/db/categories';
import { EXPENSE_KINDS } from '@/db/spending';
import { CategoryPicker, CategoryPickerModal } from '@/entities/category';
import { splitParts } from '@/entities/transaction';
import Chip from '@/shared/ui/Chip';
import SectionHeading from '@/shared/ui/SectionHeading';
import { PencilIcon, SplitIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import type { Tx } from '../model/useTransaction';
import FundNote from './FundNote';
import SplitView from './SplitView';

type Props = {
  tx: Tx;
  /** a merchant of different categories: its categories, picked with a tap */
  mixedCats: Array<{ id: number; label: string }> | null;
  saving: boolean;
  choose: (categoryId: number | null) => void;
  /** opens "Разделить по категориям" */
  onSplit: () => void;
};

/**
 * The operation's category: a settled refund says so; a merchant of different categories offers its ones; a categorized
 * one shows it with "Сменить"; none yet — the categories right away. Spending can be split between categories
 * ("Разделить по категориям"); a split one shows its parts.
 */
export default function TransactionCategory({ tx, mixedCats, saving, choose, onSplit }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const category = txCategoryLabel(tx);
  const parts = splitParts(tx);
  const splitLink = (EXPENSE_KINDS as ReadonlyArray<string>).includes(tx.kind) ? (
    <TouchableOpacity style={styles.splitLink} onPress={onSplit} disabled={saving}>
      <SplitIcon color={colors.accent} size={16} />
      <Text style={styles.changeText}>Разделить по категориям</Text>
    </TouchableOpacity>
  ) : null;

  // settled on its purchase earlier (the purchase was reduced / deleted): it no longer counts by itself
  if (tx.refund_settled_at) return <Text style={styles.refundDone}>✓ Возврат учтён в покупке</Text>;
  if (parts) return <SplitView parts={parts} total={tx.amount_minor} currency={tx.currency} onEdit={onSplit} />;
  if (!category && !mixedCats?.length) {
    return (
      <>
      <CategoryPicker
        title="Выберите категорию"
        selectedId={tx.category_id}
        onSelect={choose}
        allowNone
        // money transfers: transfer-type categories first
        transferFirst={tx.kind === 'transfer'}
        deposit={tx.kind === 'deposit'}
        disabled={saving}
      />
      {splitLink}
      </>
    );
  }
  return (
    <>
      {/* no gear here: category management is in the "Сменить категорию" sheet */}
      <SectionHeading title="Категория" />
      <View style={styles.currentRow}>
        {mixedCats?.length ? (
          <>
            {mixedCats.map((c) => (
              <Chip key={c.id} label={c.label} selected={c.id === tx.category_id} disabled={saving} onPress={() => { if (c.id !== tx.category_id) choose(c.id); }} />
            ))}
            {/* picked elsewhere, not among the merchant's yet (e.g. just now from "Сменить") */}
            {category && !mixedCats.some((c) => c.id === tx.category_id) ? <Chip label={category} selected /> : null}
          </>
        ) : <Chip label={category!} selected />}
        <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setPickerOpen(true)} accessibilityLabel="Сменить категорию">
          <PencilIcon color={colors.accent} size={16} />
          <Text style={styles.changeText}>Сменить</Text>
        </TouchableOpacity>
      </View>
      <FundNote txId={tx.id} categoryId={tx.category_id} merchantKey={tx.merchant_key} occurredAt={tx.occurred_at} amount={tx.amount_minor} />
      {splitLink}
      <CategoryPickerModal
        visible={pickerOpen}
        title="Сменить категорию"
        selectedId={tx.category_id}
        transferFirst={!mixedCats?.length && tx.kind === 'transfer'}
        deposit={!mixedCats?.length && tx.kind === 'deposit'}
        allowNone
        onPick={(id) => { setPickerOpen(false); choose(id); }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  splitLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  refundDone: { fontSize: 15, color: colors.income, fontWeight: '600' },
});
