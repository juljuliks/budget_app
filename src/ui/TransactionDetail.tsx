import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sheetAlert } from './sheetAlert';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTransaction, markTransactionSeen, setTransactionAmount, setTransactionNote } from '../db/transactions';
import { Currency, isCurrency } from '../db/fx';
import CurrencyPicker from './CurrencyPicker';
import { formatMoneyWithCurrency, parseAmountInput, toInputValue } from './money';
import { AMOUNT_HINT } from './strings';
import { assignCategory, MerchantChoice, merchantChangePreview } from '../assign';
import { findCategoryForMerchant } from '../categorize';
import { groupNameOf } from '../db/merchants';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay, formatTime, isIncome, merchantLabel, plural } from './format';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import Chip from './Chip';
import SectionHeading from './SectionHeading';
import { PencilIcon } from './icons';
import { categoryLabel, getCategory, txCategoryLabel } from '../db/categories';
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
  const [amountOpen, setAmountOpen] = useState(false);
  const [amountCurrency, setAmountCurrency] = useState<Currency>('GEL');

  // the merchant's category (its rule): new transactions of the merchant get it automatically
  const [merchantCategory, setMerchantCategory] = useState<string | null>(null);
  // the merchant's group, shown as the merchant
  const [groupName, setGroupName] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await getTransaction(txId);
    setTx(t ?? null);
    const rule = t?.merchant_key && isRememberable(t.kind) ? await findCategoryForMerchant(t.merchant_key) : null;
    const c = rule ? await getCategory(rule.category_id) : undefined;
    setMerchantCategory(c ? categoryLabel(c) : null);
    setGroupName(t?.merchant_key ? await groupNameOf(t.merchant_key) : null);
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

  async function assign(categoryId: number | null, choice?: MerchantChoice) {
    setSaving(true);
    try {
      await assignCategory(txId, categoryId, choice);
      navigation.goBack();
    } catch (e) {
      console.error('assign category failed', e);
      setSaving(false);
    }
  }

  // A purchase / payment at a merchant with another category or none: ask whether the new one is for this
  // operation only (the usual choice) or becomes the merchant's (with what that changes), or nothing changes
  async function choose(categoryId: number | null) {
    if (saving) return;
    const change = await merchantChangePreview(txId, categoryId).catch((e) => { console.error('preview failed', e); return null; });
    if (!change) { await assign(categoryId); return; }
    const [from, to] = await Promise.all([change.fromCategoryId === null ? null : getCategory(change.fromCategoryId), getCategory(categoryId!)]);
    const sum = change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
    const now = from ? `Сейчас у мерчанта «${categoryLabel(from)}». ` : 'У мерчанта пока нет категории. ';
    sheetAlert(
      `Категория «${to ? categoryLabel(to) : '?'}» — для этой операции или для мерчанта «${change.merchant}»?`,
      `${now}Для мерчанта: категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${sum}, и новые операции мерчанта будут получать её автоматически. Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Только для этой операции', onPress: () => { assign(categoryId, 'only'); } },
        { text: 'Для мерчанта', style: 'secondary', onPress: () => { assign(categoryId, 'merchant'); } },
      ]);
  }

  async function saveAmount(text: string): Promise<string | null> {
    const minor = parseAmountInput(text);
    if (minor === null) return AMOUNT_HINT;
    await setTransactionAmount(txId, minor, amountCurrency);
    emitTransactionsChanged();
    reload();
    return null;
  }

  async function saveNote(text: string): Promise<string | null> {
    await setTransactionNote(txId, text);
    emitTransactionsChanged();
    reload();
    return null;
  }

  if (!tx) return <View style={styles.center}><ActivityIndicator /></View>;
  const category = txCategoryLabel(tx);
  const merchantName = tx.raw_merchant || tx.merchant_key;
  const rememberable = !!tx.merchant_key && isRememberable(tx.kind);

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* tap the amount to correct it (and its currency) */}
      <TouchableOpacity
        style={styles.amountRow}
        onPress={() => { setAmountCurrency(isCurrency(tx.currency) ? tx.currency : 'GEL'); setAmountOpen(true); }}
        accessibilityLabel="Изменить сумму"
      >
        <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
          {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
        </Text>
        <PencilIcon color={colors.accent} size={18} />
      </TouchableOpacity>
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

      {/* only purchases / payments are remembered for their merchant (see assignCategory) */}
      {rememberable && merchantCategory ? (
        <Text style={styles.merchantInfo}>
          Категория {groupName ? `группы мерчантов «${groupName}»` : `мерчанта «${merchantName}»`}: {merchantCategory}. Новые операции мерчанта получают её автоматически.
        </Text>
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
        visible={amountOpen}
        title="Сумма"
        initialValue={toInputValue(tx.amount_minor)}
        placeholder="0.00"
        keyboardType="decimal-pad"
        maxLength={12}
        onSubmit={saveAmount}
        onClose={() => setAmountOpen(false)}
      >
        <CurrencyPicker value={amountCurrency} onChange={setAmountCurrency} />
      </TextInputModal>
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
        <Button title="Удалить операцию" danger disabled={saving} onPress={() => confirmDeleteTransaction(tx, () => navigation.goBack())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
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
  merchantInfo: { fontSize: 13, color: colors.muted, marginTop: 10 },
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
