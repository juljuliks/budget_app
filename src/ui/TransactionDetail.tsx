import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTransaction, markTransactionSeen, setMerchantDetached, setTransactionNote } from '../db/transactions';
import { assignCategory } from '../assign';
import { findCategoryForMerchant } from '../categorize';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay, formatTime, isIncome, merchantLabel } from './format';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import Chip from './Chip';
import SectionHeading from './SectionHeading';
import { PencilIcon } from './icons';
import { txCategoryLabel } from '../db/categories';
import { colors } from './theme';
import { isRememberable } from '../types';
import TextInputModal from './TextInputModal';
import { confirmDeleteTransaction } from './transactionActions';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;
type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export default function TransactionDetail({ route, navigation }: Props) {
  const { txId } = route.params;
  const [tx, setTx] = useState<Tx | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // the merchant's rule category: only with a rule can this transaction be detached from it
  const [ruleCategoryId, setRuleCategoryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const t = await getTransaction(txId);
    setTx(t ?? null);
    const rule = t?.merchant_key && isRememberable(t.kind) ? await findCategoryForMerchant(t.merchant_key) : null;
    setRuleCategoryId(rule?.category_id ?? null);
    return t;
  }, [txId]);

  const reload = useCallback(() => {
    load().catch((e) => console.error('load transaction failed', e));
  }, [load]);

  // on focus: the category may have been changed on the category screens
  useFocusEffect(useCallback(() => {
    (async () => {
      const t = await load();
      // opening a transaction marks it read (list dot, tab badge)
      if (t && t.seen_at === null && await markTransactionSeen(txId)) emitTransactionsChanged();
    })().catch((e) => console.error('load transaction failed', e));
  }, [txId, load]));

  async function choose(categoryId: number | null) {
    if (saving) return;
    setSaving(true);
    try {
      await assignCategory(txId, categoryId);
      navigation.goBack();
    } catch (e) {
      console.error('assign category failed', e);
      setSaving(false);
    }
  }

  async function saveNote(text: string): Promise<string | null> {
    await setTransactionNote(txId, text);
    emitTransactionsChanged();
    reload();
    return null;
  }

  // "Открепить мерчанта для этой транзакции": one way, the rule never touches it again and its category is its own
  function detach() {
    if (!tx) return;
    Alert.alert(
      'Открепить мерчанта для этой транзакции?',
      `Правило для «${tx.raw_merchant || tx.merchant_key}» больше не будет менять её категорию, и ей можно выбрать свою. Вернуть привязку нельзя.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Открепить', style: 'destructive', onPress: () => {
            setMerchantDetached(txId, true).then(reload).catch((e) => console.error('detach failed', e));
          },
        },
      ]);
  }

  if (!tx) return <View style={styles.center}><ActivityIndicator /></View>;
  const category = txCategoryLabel(tx);
  const merchantName = tx.raw_merchant || tx.merchant_key;
  const rememberable = !!tx.merchant_key && isRememberable(tx.kind);

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
        {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
      </Text>
      <Text style={styles.merchant}>{merchantLabel(tx)}</Text>
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>

      {tx.kind === 'refund' ? (
        // a refund is settled on its purchase (reduced / deleted) instead of getting a category
        <View style={styles.refundBox}>
          {tx.refund_settled_at ? (
            <Text style={styles.refundDone}>✓ Возврат учтён в покупке</Text>
          ) : (
            <>
              <Text style={styles.refundText}>Найдите покупку, за которую вернули деньги, и уменьшите её сумму или удалите её.</Text>
              <Button title="Найти покупку" onPress={() => navigation.navigate('RefundResolve', { refundId: txId })} />
            </>
          )}
        </View>
      ) : category ? (
        // categorized: the category and "Сменить" (the picker opens in a sheet)
        <>
          {/* no gear here: category management is in the "Сменить категорию" sheet */}
          <SectionHeading title="Категория" />
          <View style={styles.currentRow}>
            <Chip label={category} selected />
            <TouchableOpacity
              style={styles.changeButton}
              disabled={saving}
              onPress={() => setPickerOpen(true)}
              accessibilityLabel="Сменить категорию"
            >
              <PencilIcon color={colors.accent} size={16} />
              <Text style={styles.changeText}>Сменить</Text>
            </TouchableOpacity>
          </View>
          <CategoryPickerModal
            visible={pickerOpen}
            title="Сменить категорию"
            selectedId={tx.category_id}
            transferFirst={tx.kind === 'transfer'}
            newCategory={{ txId }}
            allowNone
            onPick={(id) => { setPickerOpen(false); choose(id); }}
            onClose={() => setPickerOpen(false)}
          />
        </>
      ) : (
        <CategoryPicker
          selectedId={tx.category_id}
          onSelect={choose}
          allowNone
          // money transfers: transfer-type categories first
          transferFirst={tx.kind === 'transfer'}
          newCategory={{ txId }}
          disabled={saving}
        />
      )}

      {/* only purchases / payments are remembered for their merchant (see assignCategory): the first pick
          creates the rule, changing the category later changes the rule. Detaching (only with a rule) is the
          way to give this one transaction a category of its own */}
      {rememberable && tx.merchant_detached ? (
        <View style={styles.detachRow}>
          <Text style={styles.detachInfo}>Откреплена от мерчанта «{merchantName}»: категория только для этой транзакции.</Text>
        </View>
      ) : rememberable && ruleCategoryId !== null ? (
        <View style={styles.detachRow}>
          <Text style={styles.detachInfo}>Категория запомнена для мерчанта «{merchantName}»: если её сменить, она сменится и для мерчанта.</Text>
          <TouchableOpacity onPress={detach} hitSlop={8}>
            <Text style={styles.link}>Открепить мерчанта для этой транзакции</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {tx.raw_sms ? (
        <>
          <Text style={styles.heading}>SMS</Text>
          <Text style={styles.sms} selectable>{tx.raw_sms}</Text>
        </>
      ) : null}

      <SectionHeading title="Заметка" />
      {tx.note ? (
        <TouchableOpacity style={styles.note} onPress={() => setNoteOpen(true)} accessibilityLabel="Изменить заметку">
          <Text style={styles.noteText}>{tx.note}</Text>
          <PencilIcon color={colors.muted} size={16} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setNoteOpen(true)} hitSlop={8}>
          <Text style={styles.link}>＋ Добавить заметку</Text>
        </TouchableOpacity>
      )}
      <TextInputModal
        visible={noteOpen}
        title="Заметка"
        initialValue={tx.note ?? ''}
        placeholder="Например, подарок маме"
        multiline
        maxLength={500}
        allowEmpty
        onSubmit={saveNote}
        onClose={() => setNoteOpen(false)}
      />

    </ScrollView>
      {/* pinned to the bottom, outside the scroll */}
      <View style={styles.footer}>
        <Button title="Удалить транзакцию" danger disabled={saving} onPress={() => confirmDeleteTransaction(tx, () => navigation.goBack())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  amount: { fontSize: 28, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
  merchant: { fontSize: 18, color: colors.text, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  refundBox: { marginTop: 24, gap: 12 },
  refundText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  refundDone: { fontSize: 15, color: colors.income, fontWeight: '600' },
  detachRow: { marginTop: 10, gap: 4 },
  detachInfo: { fontSize: 13, color: colors.muted },
  link: { fontSize: 14, color: colors.accent },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.surface, padding: 12, borderRadius: 8,
  },
  noteText: { flex: 1, fontSize: 15, color: colors.text },
  footer: {
    padding: 16, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
