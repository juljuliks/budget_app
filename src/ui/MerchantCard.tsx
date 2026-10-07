import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { sheetAlert } from './sheetAlert';
import { useNavigation } from '@react-navigation/native';
import { categoryChangeTotals } from '../assign';
import { addMerchantCategory, getMerchant, merchantCategories, MerchantDetails, removeMerchantCategory, setMerchantCategory, setMerchantMixed } from '../db/merchants';
import { categoryLabel, categoryLabelOf, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import { emitTransactionsChanged } from '../events';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import Chip from './Chip';
import { PencilIcon } from './icons';
import { plural } from './format';
import type { CategoryInfo } from './MerchantsScreen';
import { colors } from './theme';
import { formatMoneyWithCurrency } from './money';
import { toast, toastError } from './toast';

type Props = {
  /** null = closed */
  merchantId: string | null;
  /** the categories' labels (the merchants screen has them); without, the card loads them */
  categories?: Map<number, CategoryInfo>;
  onClose: () => void;
  onChanged: () => void;
  /** "Показать операции" leaves for the operations tab: whatever the card was opened over closes too */
  onLeave?: () => void;
};

const money = (totals: Array<{ currency: string; amount_minor: number }>) =>
  totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');

/**
 * A merchant's card (bottom sheet): its operations and its category (change / unpin), or — a merchant of different
 * categories — its list of categories, offered for its operations.
 */
export default function MerchantCard({ merchantId, categories: given, onClose, onChanged, onLeave }: Props) {
  const navigation = useNavigation();
  const [m, setM] = useState<MerchantDetails | null>(null);
  const [loaded, setLoaded] = useState<Map<number, CategoryInfo>>(new Map());
  const categories = given ?? loaded;
  // of different categories: its list, how many of its operations each has
  const [had, setHad] = useState<Array<{ id: number; label: string; n: number }>>([]);
  // adding to that list (the categories sheet)
  const [adding, setAdding] = useState(false);
  // the categories sheet ("Сменить"); a merchant without a category shows them right in the card
  const [picking, setPicking] = useState(false);

  // the parent passes onClose inline: kept in a ref so a parent re-render doesn't reset and reload the card
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(() => {
    if (merchantId === null) return;
    getMerchant(merchantId).then((d) => {
      setM(d);
      // the merchant is gone (deleted meanwhile)
      if (!d) onCloseRef.current();
    }).catch((e) => console.error('load merchant failed', e));
    merchantCategories(merchantId, 100).then((cs) => setHad(cs.map((c) => ({ id: c.id, label: categoryLabel(c), n: c.n }))))
      .catch((e) => console.error('load merchant categories failed', e));
  }, [merchantId]);

  // opened from an operation: the labels aren't passed in
  useEffect(() => {
    if (given || merchantId === null) return;
    Promise.all([listCategories(), categoryColors()])
      .then(([cats, colorOf]) => setLoaded(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }]))))
      .catch((e) => console.error('load categories failed', e));
  }, [given, merchantId]);

  // a new merchant: start clean
  useEffect(() => {
    setPicking(false);
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
    // a category just created from the picker isn't in the screen's list yet
    const label = categories.get(categoryId)?.label ?? await categoryLabelOf(categoryId);
    sheetAlert(
      `Категория «${label}» для «${m.name}»?`,
      `Новые операции мерчанта будут получать её автоматически.${n > 0
        ? ` Категория изменится у ${n} ${plural(n, ['операции', 'операций', 'операций'])} на ${money(totals)}.`
        : ''} Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить', onPress: () => {
            setMerchantCategory(m.id, categoryId).then(() => {
              setPicking(false);
              changed();
              toast(`Категория «${label}» назначена мерчанту «${m.name}»`);
            }).catch((e) => { console.error('set merchant category failed', e); toastError('Не удалось сохранить'); });
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
            setMerchantCategory(m.id, null).then(() => { changed(); toast(`Категория откреплена от «${m.name}»`); })
              .catch((e) => { console.error('unpin failed', e); toastError('Не удалось открепить'); });
          },
        },
      ]);
  }

  // different categories: no category of its own, each new operation asks; off: none, until one is picked
  function setMixed(on: boolean) {
    if (!m) return;
    setMerchantMixed(m.id, on).then(async () => {
      changed();
      // nothing in its list yet (its operations had no category): which categories it has, right away
      if (on && (await merchantCategories(m.id)).length === 0) setAdding(true);
    }).catch((e) => { console.error('set merchant mixed failed', e); toastError('Не удалось сохранить'); });
  }

  function addToList(categoryId: number | null) {
    setAdding(false);
    if (!m || categoryId === null) return;
    addMerchantCategory(m.id, categoryId).then(changed).catch((e) => { console.error('add merchant category failed', e); toastError('Не удалось сохранить'); });
  }

  function removeFromList(categoryId: number) {
    if (!m) return;
    removeMerchantCategory(m.id, categoryId).then(changed).catch((e) => { console.error('remove merchant category failed', e); toastError('Не удалось сохранить'); });
  }


  function showTransactions() {
    if (!m) return;
    onClose();
    onLeave?.();
    // the Transactions tab searching this merchant's name, back returns to the merchants (`as never`: a nested navigate the root types don't describe)
    navigation.navigate({ name: 'Main', params: { screen: 'Transactions', params: { query: m.name, nonce: Date.now(), from: 'Merchants' } } } as never);
  }

  const category = m?.category_id != null ? categories.get(m.category_id) : undefined;

  return (
    <BottomSheet visible={merchantId !== null} onClose={onClose} style={styles.sheet}>
        {!m ? null : (
          <SheetScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{m.name}</Text>
            {/* like a category's sheet: how many operations and how much; with some, a link to them on the right */}
            <View style={styles.summaryRow}>
              <Text style={styles.meta} numberOfLines={1}>
                {m.count} {plural(m.count, ['операция', 'операции', 'операций'])}
                {m.totals.length ? ` · ${money(m.totals)}` : ''}
              </Text>
              {m.count > 0 ? (
                <TouchableOpacity onPress={showTransactions} hitSlop={8} accessibilityRole="link">
                  <Text style={styles.link}>Показать операции ›</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* a delivery of groceries or meals: no category of its own, each new operation asks */}
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Разные категории</Text>
                <Text style={styles.switchHint}>Каждая новая операция спрашивает категорию</Text>
              </View>
              <Switch value={m.mixed} onValueChange={setMixed} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.bg} />
            </View>

            {m.mixed ? (
              // its list: offered for its operations; ✕ takes one off, ＋ adds (one picked for an operation joins by itself)
              <>
                <Text style={styles.heading}>Категории мерчанта</Text>
                <View style={styles.currentRow}>
                  {had.map((h) => (
                    <Chip key={h.id} label={h.n ? `${h.label} · ${h.n}` : h.label} trailing="✕" onPress={() => removeFromList(h.id)} />
                  ))}
                  <Chip label="Добавить категорию" add onPress={() => setAdding(true)} />
                </View>
                <CategoryPickerModal
                  visible={adding}
                  title={had.length ? 'Добавить категорию' : `Какие категории бывают у «${m.name}»?`}
                  selectedId={null}
                  onPick={addToList}
                  onClose={() => setAdding(false)}
                />
              </>
            ) : category ? (
              // the category and "Сменить" (the categories open in a sheet), as on an operation
              <>
                <Text style={styles.heading}>Категория</Text>
                <View style={styles.currentRow}>
                  <Chip label={category.label} selected />
                  <TouchableOpacity style={styles.changeButton} onPress={() => setPicking(true)} accessibilityLabel="Сменить категорию">
                    <PencilIcon color={colors.accent} size={16} />
                    <Text style={styles.changeText}>Сменить</Text>
                  </TouchableOpacity>
                </View>
                <Button title="Открепить категорию" danger outline onPress={unpin} style={styles.action} />
                <CategoryPickerModal
                  visible={picking}
                  title="Сменить категорию"
                  selectedId={m.category_id}
                  onPick={(id) => { setPicking(false); pick(id); }}
                  onClose={() => setPicking(false)}
                />
              </>
            ) : (
              // none yet: the categories right here, that's what the card is opened for
              <View style={styles.pickerTop}>
                <CategoryPicker title="Выберите категорию" selectedId={null} onSelect={pick} />
              </View>
            )}

          </SheetScrollView>
        )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%', minHeight: 200, paddingBottom: 0 },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 14, color: colors.accent },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  action: { marginTop: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchText: { flex: 1 },
  switchTitle: { fontSize: 16, color: colors.text },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pickerTop: { marginTop: 8 },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
});
