import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sheetAlert } from './sheetAlert';
import { getTransaction, markTransactionSeen, setTransactionAmount, setTransactionNote } from '../db/transactions';
import { Currency, isCurrency } from '../db/fx';
import CurrencyPicker from './CurrencyPicker';
import { formatMoneyWithCurrency, parseAmountInput, toInputValue } from './money';
import { AMOUNT_HINT } from './strings';
import { assignCategory, MerchantChoice, merchantChangePreview } from '../assign';
import { findCategoryForMerchant } from '../categorize';
import { groupNameOf } from '../db/merchants';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import { formatAmount, formatDay, formatTime, isIncome, merchantLabel, plural } from './format';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import Chip from './Chip';
import SectionHeading from './SectionHeading';
import { PencilIcon } from './icons';
import { categoryLabel, getCategory, txCategoryLabel } from '../db/categories';
import { colors } from './theme';
import { isRememberable } from '../types';
import { Controller } from 'react-hook-form';
import TextInputModal from './TextInputModal';
import { useLoadedForm } from './form';
import { confirmDeleteTransaction } from './transactionActions';
import { useLast } from './useLast';

type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

type Props = {
  /** the operation to show; null = closed */
  txId: number | null;
  onClose: () => void;
};

/**
 * An operation in a sheet (from the list or a notification): the amount (tap to correct it), its category and the
 * merchant's (a refund is subtracted from its category), the SMS, a note; "Удалить операцию" at the bottom.
 */
export default function TransactionSheet({ txId: openId, onClose }: Props) {
  // kept while the sheet slides away
  const txId = useLast(openId) ?? -1;
  const visible = openId !== null;
  const [tx, setTx] = useState<Tx | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  // the amount sheet: the amount and its currency, from what is saved
  const amountForm = useLoadedForm<{ value: string; currency: Currency }>(
    amountOpen && tx ? { value: toInputValue(tx.amount_minor), currency: isCurrency(tx.currency) ? tx.currency : 'GEL' } : null, amountOpen);

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

  // on open: what it is now; opening it marks it read (list dot, tab badge)
  useEffect(() => {
    if (!visible) return;
    setTx(null);
    setSaving(false);
    (async () => {
      const t = await load();
      if (t && t.seen_at === null && await markTransactionSeen(txId)) emitTransactionsChanged();
    })().catch((e) => console.error('load transaction failed', e));
  }, [visible, txId, load]);
  // while open: a category or a merchant changed elsewhere (the category sheet, a merchant's card)
  useEffect(() => (visible ? onTransactionsChanged(reload) : undefined), [visible, reload]);

  async function assign(categoryId: number | null, choice?: MerchantChoice) {
    setSaving(true);
    try {
      await assignCategory(txId, categoryId, choice);
      onClose();
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
    await setTransactionAmount(txId, minor, amountForm.getValues('currency'));
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

  if (!tx) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title="Операция">
        <View style={styles.center}><ActivityIndicator /></View>
      </BottomSheet>
    );
  }
  const category = txCategoryLabel(tx);
  const merchantName = tx.raw_merchant || tx.merchant_key;
  const rememberable = !!tx.merchant_key && isRememberable(tx.kind);

  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
    <SheetScrollView contentContainerStyle={styles.content}>
      {/* tap the amount to correct it (and its currency) */}
      <TouchableOpacity
        style={styles.amountRow}
        onPress={() => setAmountOpen(true)}
        accessibilityLabel="Изменить сумму"
      >
        <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
          {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
        </Text>
        <PencilIcon color={colors.accent} size={18} />
      </TouchableOpacity>
      <Text style={styles.merchant}>{merchantLabel(tx)}</Text>
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>

      {tx.refund_settled_at ? (
        // settled on its purchase earlier (the purchase was reduced / deleted): it no longer counts by itself
        <Text style={styles.refundDone}>✓ Возврат учтён в покупке</Text>
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
        form={amountForm}
        placeholder="0.00"
        keyboardType="decimal-pad"
        maxLength={12}
        onSubmit={saveAmount}
        onClose={() => setAmountOpen(false)}
      >
        <Controller control={amountForm.control} name="currency" render={({ field }) => <CurrencyPicker value={field.value} onChange={field.onChange} />} />
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

      <SheetActions submit={null} extra={[{ title: 'Удалить операцию', danger: true, onPress: () => confirmDeleteTransaction(tx, onClose) }]} />
    </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  center: { height: 160, alignItems: 'center', justifyContent: 'center' },
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
  refundDone: { fontSize: 15, color: colors.income, fontWeight: '600' },
  merchantInfo: { fontSize: 13, color: colors.muted, marginTop: 10 },
  link: { fontSize: 14, color: colors.accent },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.surface, padding: 12, borderRadius: 8,
  },
  noteText: { flex: 1, fontSize: 15, color: colors.text },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
