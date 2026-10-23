import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirmDeleteTransaction, confirmUnsplit, splitParts } from '@/entities/transaction';
import { isRememberable } from '@/domain/types';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import Page from '@/shared/ui/Page';
import { colors } from '@/shared/theme/theme';
import { useCategoryChoice } from './model/useCategoryChoice';
import { useMixedPick } from './model/useMixedPick';
import { useTransaction } from './model/useTransaction';
import AmountModal from './ui/AmountModal';
import KindSheet from './ui/KindSheet';
import NoteSection from './ui/NoteSection';
import SplitSheet from './ui/SplitSheet';
import PaymentNote from './ui/PaymentNote';
import TransactionCategory from './ui/TransactionCategory';
import TransactionHeader from './ui/TransactionHeader';

type Props = {
  txId: number;
  /** leaves the page: the operation deleted, a category picked */
  onClose: () => void;
};

/**
 * An operation's page (from the list, a notification, a merchant's or a category's page): the amount (tap to correct
 * it), the merchant and the category (links to their pages), the merchant's category (a refund is subtracted from its
 * category), the SMS, a note; "Удалить операцию" pinned at the bottom. The forms over it are sheets.
 */
export default function TransactionView({ txId, onClose }: Props) {
  const { tx, merchantCategory, mixedCats, reload, failed } = useTransaction(txId, true);
  const { saving, choose } = useCategoryChoice(txId, tx ?? null, true, onClose);
  const split = !!tx && splitParts(tx) !== null;
  const showChips = !!tx && tx.id === txId && !split && !!mixedCats?.length;
  const currentId = showChips && tx ? tx.category_id : null;
  const { picked, toggle } = useMixedPick(txId, currentId, showChips);
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const savedChip = useRef<number | null>(null);
  useEffect(() => { savedChip.current = null; }, [txId]);
  const lone = showChips && picked.length === 1 ? picked[0] : null;
  // one chip: save it and stay. "Готово" closes; a second chip turns the button into "Разделить"
  useEffect(() => {
    if (lone == null || lone === currentId || lone === savedChip.current) return;
    savedChip.current = lone;
    chooseRef.current(lone, false);
  }, [lone, currentId]);
  const [amountOpen, setAmountOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitSeed, setSplitSeed] = useState<number[] | null>(null);
  const [kindOpen, setKindOpen] = useState(false);

  if (!tx) {
    return tx === null
      ? <Text style={styles.gone}>Операция не найдена: возможно, её удалили.</Text>
      : <Loading failed={failed} onRetry={reload} />;
  }
  const merchantName = tx.raw_merchant || tx.merchant_key;
  // only purchases / payments are remembered for their merchant (see assignCategory)
  const rememberable = !!tx.merchant_key && isRememberable(tx.kind);
  const distribute = showChips && picked.length >= 2;
  const one = showChips && picked.length === 1;

  return (
    <Page contentStyle={styles.content} footer={(
      <SheetActions
        submit={distribute
          ? { title: 'Разделить', onPress: () => { setSplitSeed(picked); setSplitOpen(true); } }
          : one ? { title: 'Готово', onPress: onClose } : null}
        style={styles.actions}
        extra={[
          ...(split ? [{ title: 'Убрать разделение', onPress: () => confirmUnsplit(tx) }] : []),
          { title: 'Удалить операцию', danger: true, onPress: () => confirmDeleteTransaction(tx, onClose) },
        ]}
      />
    )}>
      <TransactionHeader tx={tx} onEditAmount={() => setAmountOpen(true)} onEditKind={() => setKindOpen(true)} merchantLinked={rememberable} />
      <TransactionCategory
        tx={tx} mixedCats={showChips ? mixedCats : null} picked={picked} saving={saving} choose={choose} onToggle={toggle}
        onSplit={(ids) => { setSplitSeed(ids ?? null); setSplitOpen(true); }}
      />

      {(rememberable || tx.kind === 'refund') && mixedCats ? (
        <Text style={styles.merchantInfo}>У «{merchantName}» разные категории: каждая новая операция спрашивает.</Text>
      ) : null}
      {rememberable && merchantCategory ? (
        <Text style={styles.merchantInfo}>
          Категория мерчанта «{merchantName}»: {merchantCategory}. Новые операции мерчанта получают её автоматически.
        </Text>
      ) : null}

      <PaymentNote tx={tx} />

      {tx.raw_sms ? (
        <>
          <Text style={styles.heading}>SMS</Text>
          <Text style={styles.sms} selectable>{tx.raw_sms}</Text>
        </>
      ) : null}

      <NoteSection txId={tx.id} note={tx.note} onSaved={reload} />
      <AmountModal visible={amountOpen} tx={tx} onClose={() => setAmountOpen(false)} onSaved={reload} />
      <KindSheet visible={kindOpen} tx={tx} onClose={() => setKindOpen(false)} />
      <SplitSheet visible={splitOpen} tx={tx} seed={splitSeed} onClose={() => { setSplitOpen(false); setSplitSeed(null); }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16 },
  actions: { marginTop: 0 },
  gone: { fontSize: 15, color: colors.muted, textAlign: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  merchantInfo: { fontSize: 13, color: colors.muted, marginTop: 10 },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
