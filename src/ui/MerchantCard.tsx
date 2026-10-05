import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { sheetAlert } from './sheetAlert';
import { useNavigation } from '@react-navigation/native';
import { categoryChangeTotals } from '../assign';
import { excludeFromGroup, getMerchant, MerchantDetails, renameMerchantGroup, setMerchantCategory } from '../db/merchants';
import { emitTransactionsChanged } from '../events';
import Button, { SheetActions } from './Button';
import CategoryPicker from './CategoryPicker';
import Checkbox from './Checkbox';
import { plural } from './format';
import { PencilIcon } from './icons';
import type { CategoryInfo } from './MerchantsScreen';
import TextInputModal from './TextInputModal';
import { colors } from './theme';
import { formatMoneyWithCurrency } from './money';

type Props = {
  /** null = closed */
  merchantId: string | null;
  categories: Map<number, CategoryInfo>;
  onClose: () => void;
  onChanged: () => void;
};

const money = (totals: Array<{ currency: string; amount_minor: number }>) =>
  totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');

/**
 * A merchant's card (bottom sheet): its transactions, its category (change / unpin), and for a group its name
 * and members, some of which can be taken out of the group.
 */
export default function MerchantCard({ merchantId, categories, onClose, onChanged }: Props) {
  const navigation = useNavigation();
  const [m, setM] = useState<MerchantDetails | null>(null);
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);

  // the parent passes onClose inline: kept in a ref so a parent re-render doesn't reset and reload the card
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(() => {
    if (merchantId === null) return;
    getMerchant(merchantId).then((d) => {
      setM(d);
      // the group is gone (all members excluded)
      if (!d) onCloseRef.current();
    }).catch((e) => console.error('load merchant failed', e));
  }, [merchantId]);

  // a new merchant: start clean
  useEffect(() => {
    setPicking(false);
    setExcluded([]);
    setM(null);
    load();
  }, [merchantId, load]);

  function changed() {
    emitTransactionsChanged();
    onChanged();
    load();
  }

  async function pick(categoryId: number | null) {
    if (!m || categoryId === null || categoryId === m.category_id) { setPicking(false); return; }
    const totals = await categoryChangeTotals(m.id, categoryId);
    const n = totals.reduce((s, t) => s + t.n, 0);
    const label = categories.get(categoryId)?.label ?? '?';
    sheetAlert(
      `Категория «${label}» для «${m.name}»?`,
      `Новые операции мерчанта будут получать её автоматически.${n > 0
        ? ` Категория изменится у ${n} ${plural(n, ['операции', 'операций', 'операций'])} на ${money(totals)}.`
        : ''} Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить', onPress: () => {
            setMerchantCategory(m.id, categoryId).then(() => { setPicking(false); changed(); })
              .catch((e) => console.error('set merchant category failed', e));
          },
        },
      ]);
  }

  function unpin() {
    if (!m) return;
    sheetAlert(
      `Открепить категорию от «${m.name}»?`,
      `Новые операции «${m.name}» будут приходить без категории. У прошлых операций категория останется.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Открепить', style: 'destructive', onPress: () => {
            setMerchantCategory(m.id, null).then(changed).catch((e) => console.error('unpin failed', e));
          },
        },
      ]);
  }

  function exclude() {
    if (!m) return;
    const all = excluded.length === m.memberRows.length;
    sheetAlert(
      `Исключить из группы «${m.name}»?`,
      `${m.memberRows.filter((r) => excluded.includes(r.key)).map((r) => r.name).join(', ')} ${excluded.length === 1
        ? 'снова станет отдельным мерчантом' : 'снова станут отдельными мерчантами'} с категорией группы.${all ? ' Группа будет удалена.' : ''}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Исключить', style: 'destructive', onPress: () => {
            excludeFromGroup(m.id, excluded).then(() => { setExcluded([]); changed(); })
              .catch((e) => console.error('exclude failed', e));
          },
        },
      ]);
  }

  function showTransactions() {
    if (!m) return;
    onClose();
    // the Transactions tab searching this merchant's name, back returns to the merchants (`as never`: a nested navigate the root types don't describe)
    navigation.navigate({ name: 'Main', params: { screen: 'Transactions', params: { query: m.name, nonce: Date.now(), from: 'Merchants' } } } as never);
  }

  const category = m?.category_id != null ? categories.get(m.category_id) : undefined;

  return (
    <>
    <BottomSheet visible={merchantId !== null} onClose={onClose} style={styles.sheet}>
        {!m ? null : (
          <SheetScrollView contentContainerStyle={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{m.name}</Text>
              {m.group ? (
                <TouchableOpacity onPress={() => setRenaming(true)} hitSlop={10} accessibilityLabel="Переименовать группу">
                  <PencilIcon color={colors.accent} size={18} />
                </TouchableOpacity>
              ) : null}
            </View>
            {/* like a category's sheet: how many operations and how much; with some, a link to them on the right */}
            <View style={styles.summaryRow}>
              <Text style={styles.meta} numberOfLines={1}>
                {m.group ? 'Группа · ' : ''}{m.count} {plural(m.count, ['операция', 'операции', 'операций'])}
                {m.totals.length ? ` · ${money(m.totals)}` : ''}
              </Text>
              {m.count > 0 ? (
                <TouchableOpacity onPress={showTransactions} hitSlop={8} accessibilityRole="link">
                  <Text style={styles.link}>Показать операции ›</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.heading}>Категория</Text>
            {picking ? (
              <>
                <CategoryPicker title="Выберите категорию" selectedId={m.category_id} onSelect={pick} />
                <SheetActions submit={null} onCancel={() => setPicking(false)} />
              </>
            ) : (
              <>
                {category ? (
                  <View style={styles.categoryRow}>
                    <View style={[styles.dot, { backgroundColor: category.color }]} />
                    <Text style={styles.categoryText}>{category.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.noCategory}>Нет: новые операции приходят без категории.</Text>
                )}
                <View style={styles.actions}>
                  <Button title={category ? 'Сменить категорию' : 'Выбрать категорию'} onPress={() => setPicking(true)} style={styles.action} />
                  {category ? (
                    <Button title="Открепить категорию" danger outline onPress={unpin} style={styles.action} />
                  ) : null}
                </View>
              </>
            )}

            {m.group ? (
              <>
                <Text style={styles.heading}>Мерчанты группы</Text>
                {m.memberRows.map((r) => {
                  const on = excluded.includes(r.key);
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={styles.memberRow}
                      onPress={() => setExcluded((prev) => (on ? prev.filter((k) => k !== r.key) : [...prev, r.key]))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Checkbox checked={on} size={20} />
                      <Text style={styles.memberName} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.memberCount}>{r.count}</Text>
                    </TouchableOpacity>
                  );
                })}
                {excluded.length > 0 ? (
                  <Button title={`Исключить из группы (${excluded.length})`} danger onPress={exclude} style={styles.action} />
                ) : (
                  <Text style={styles.hint}>Отметьте мерчантов, чтобы исключить их из группы.</Text>
                )}
              </>
            ) : null}

          </SheetScrollView>
        )}
    </BottomSheet>
      <TextInputModal
        visible={renaming}
        title="Название группы"
        initialValue={m?.name}
        maxLength={40}
        onSubmit={async (name) => {
          if (!m) return null;
          await renameMerchantGroup(m.id, name);
          setRenaming(false);
          changed();
          return null;
        }}
        onClose={() => setRenaming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%', minHeight: 200, paddingBottom: 0 },
  content: { padding: 16, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 14, color: colors.accent },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categoryText: { fontSize: 16, color: colors.text },
  noCategory: { fontSize: 14, color: colors.muted },
  actions: { marginTop: 12, gap: 4 },
  action: { marginTop: 8 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  memberName: { flex: 1, fontSize: 15, color: colors.text },
  memberCount: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
});
