import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { txCategoryLabel } from '@/db/categories';
import { EXPENSE_KINDS } from '@/db/spending';
import { CategoryPickerModal } from '@/entities/category';
import { merchantLabel, splitParts } from '@/entities/transaction';
import Chip from '@/shared/ui/Chip';
import SectionHeading from '@/shared/ui/SectionHeading';
import SelectField from '@/shared/ui/SelectField';
import { openCategory } from '@/shared/navigation/navigation';
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

/**
 * The operation's category: a field (a tap opens "Сменить категорию", the pick saved without leaving the page; none
 * yet — "Без категории") and a "›" beside it to the category's page. A long press in the list picks several and opens
 * the split.
 * A merchant of different categories adds its chips under the value ("Разные категории у «…»"; a category picked
 * elsewhere is not among them): a tap highlights one (saved at once; the back arrow leaves) or several ("Разделить"
 * opens the split).
 * A refund keeps the chips. A split one shows its parts; a settled refund says so.
 */
export default function TransactionCategory({ tx, mixedCats, picked, saving, choose, onToggle, onSplit }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const category = txCategoryLabel(tx);
  const parts = splitParts(tx);
  const canSplit = [...EXPENSE_KINDS, 'refund'].includes(tx.kind);

  if (tx.refund_settled_at) return <Text style={styles.refundDone}>✓ Возврат учтён в покупке</Text>;
  if (parts) return <SplitView parts={parts} total={tx.amount_minor} currency={tx.currency} onEdit={() => onSplit()} />;
  return (
    <>
      <SectionHeading title="Категория" />
      <SelectField
        value={tx.category_id !== null && category ? category : NO_CATEGORY}
        onPress={() => setPickerOpen(true)}
        accessibilityLabel="Сменить категорию"
        testID="tx-category"
        disabled={saving}
        open={tx.category_id !== null && category ? { onPress: () => openCategory(tx.category_id!), accessibilityLabel: 'Открыть категорию' } : undefined}
      />
      {mixedCats?.length ? (
        <>
          <SectionHeading title={`Разные категории у «${merchantLabel(tx)}»`} />
          <View style={styles.chips}>
            {mixedCats.map((c) => (
              <Chip key={c.id} label={c.label} selected={picked.includes(c.id)} disabled={saving} onPress={() => onToggle(c.id)} />
            ))}
          </View>
        </>
      ) : null}
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  refundDone: { fontSize: 15, color: colors.income, fontWeight: '600' },
});
