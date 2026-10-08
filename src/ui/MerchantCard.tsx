import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { sheetAlert } from './sheetAlert';
import { useNavigation } from '@react-navigation/native';
import { addMerchantCategory, deleteMerchants, getMerchant, merchantFollowers, merchantCategories, MerchantDetails, merchantUsedCategories, removeMerchantCategory, setMerchantCategory, setMerchantMixed } from '../db/merchants';
import { categoryLabel, categoryLabelOf, listCategories } from '../db/categories';
import { categoryColors } from '../db/colors';
import { emitTransactionsChanged } from '../events';
import { SheetActions } from './Button';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import Chip from './Chip';
import SectionHeading from './SectionHeading';
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
 * A merchant's card (bottom sheet): its operations, "Разные категории", and the categories right in it — the merchant's
 * one or "Без категории", or, of different categories, several (offered for its operations); "Сохранить" says what a
 * change means first (no question for a merchant getting its first category or none).
 */
export default function MerchantCard({ merchantId, categories: given, onClose, onChanged, onLeave }: Props) {
  const navigation = useNavigation();
  const [m, setM] = useState<MerchantDetails | null>(null);
  const [loaded, setLoaded] = useState<Map<number, CategoryInfo>>(new Map());
  const categories = given ?? loaded;
  // what the card edits, saved with "Сохранить": of different categories or not, the merchant's category, its list
  const [mixed, setMixed] = useState(false);
  const [single, setSingle] = useState<number | null>(null);
  const [list, setList] = useState<number[]>([]);
  // the saved list (to tell what changed)
  const [savedList, setSavedList] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  // "Сменить": the categories sheet
  const [changing, setChanging] = useState(false);
  // different categories: "Добавить категорию"
  const [adding, setAdding] = useState(false);

  // the parent passes onClose inline: kept in a ref so a parent re-render doesn't reset and reload the card
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(() => {
    if (merchantId === null) return;
    Promise.all([getMerchant(merchantId), merchantCategories(merchantId, 100)]).then(([d, cs]) => {
      setM(d);
      // the merchant is gone (deleted meanwhile)
      if (!d) { onCloseRef.current(); return; }
      setMixed(d.mixed);
      setSingle(d.category_id);
      setList(cs.map((c) => c.id));
      setSavedList(cs.map((c) => c.id));
    }).catch((e) => console.error('load merchant failed', e));
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
    setM(null);
    setSaving(false);
    load();
  }, [merchantId, load]);

  function changed() {
    emitTransactionsChanged();
    onChanged();
    load();
  }

  const label = async (id: number) => categories.get(id)?.label ?? await categoryLabelOf(id);
  const sameList = list.length === savedList.length && list.every((id) => savedList.includes(id));
  const dirty = !!m && (mixed !== m.mixed || (mixed ? !sameList : single !== m.category_id));

  // switched on with an empty list: the categories its operations have, picked already
  function switchMixed(on: boolean) {
    setMixed(on);
    if (on && m && list.length === 0) merchantUsedCategories(m.id).then(setList).catch((e) => console.error('load used categories failed', e));
  }

  function toggle(id: number | null) {
    // "Без категории": the merchant's own choice (not offered in the list of different ones)
    if (id === null) { if (!mixed) setSingle(null); return; }
    if (mixed) setList((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    else setSingle(id);
  }

  // "Сохранить": what the choice means, then save
  async function save() {
    if (!m || !dirty) return;
    // saved: the card is done
    const run = (apply: () => Promise<void>) => {
      setSaving(true);
      apply().then(() => { changed(); onClose(); }).catch((e) => { console.error('save merchant failed', e); toastError('Не удалось сохранить'); })
        .finally(() => setSaving(false));
    };
    const confirm = (title: string, message: string, apply: () => Promise<void>) => sheetAlert(title, message, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Продолжить', onPress: () => run(apply) },
    ]);
    if (mixed) {
      const names = await Promise.all(list.map(label));
      const pinned = m.category_id !== null ? await label(m.category_id) : null;
      confirm(
        names.length ? `Разные категории у «${m.name}»: ${names.map((n) => `«${n}»`).join(', ')}` : `Разные категории у «${m.name}»`,
        `Каждая новая операция «${m.name}» будет спрашивать категорию${names.length ? ' — в уведомлении кнопками будут эти категории' : ''}. `
          + 'Категория, выбранная для операции, добавится к ним. '
          + (pinned ? `Категория мерчанта «${pinned}» открепится, у прошлых операций она останется.` : 'У прошлых операций категории не изменятся.'),
        async () => {
          await setMerchantMixed(m.id, true);
          // the list as picked: setMerchantMixed adds the ones its operations had
          const now = (await merchantCategories(m.id, 1000)).map((c) => c.id);
          for (const id of now) if (!list.includes(id)) await removeMerchantCategory(m.id, id);
          for (const id of list) if (!now.includes(id)) await addMerchantCategory(m.id, id);
          toast(`«${m.name}»: разные категории`);
        });
      return;
    }
    const name = single === null ? null : await label(single);
    const apply = (past: 'change' | 'keep') => async () => {
      if (single === null && m.mixed) await setMerchantMixed(m.id, false);
      else await setMerchantCategory(m.id, single, past);
      toast(name ? `Категория «${name}» назначена мерчанту «${m.name}»` : `Новые операции «${m.name}» будут приходить без категории`);
    };
    // its first category, none for one of different categories: nothing to change in the past, no question
    if (m.category_id === null) {
      if (m.mixed && name) {
        confirm(`Категория «${name}» для «${m.name}»`, 'Новые операции мерчанта будут получать её автоматически. Разные категории выключатся.', apply('change'));
      } else run(apply('change'));
      return;
    }
    // another category or none: the past operations that followed the old one — changed with it, or kept as they are
    const followers = await merchantFollowers(m.id);
    if (followers.count === 0) { run(apply('change')); return; }
    const old = await label(m.category_id);
    const n = followers.count;
    sheetAlert(
      name ? `Категория «${name}» для «${m.name}»` : `Без категории для «${m.name}»`,
      `Новые операции будут ${name ? `получать «${name}»` : 'приходить без категории'}. Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        // the past ones: the new category (or none), or the one they have
        { text: name ?? 'Без категории', onPress: () => run(apply('change')) },
        { text: old, style: 'secondary', onPress: () => run(apply('keep')) },
      ],
      `Какую категорию сделать для ${n} ${plural(n, ['прошлой операции', 'прошлых операций', 'прошлых операций'])} на ${money(followers.totals)}?`);
  }

  // its operations stay with their categories, without the merchant (as deleting from the merchants' list)
  function remove() {
    if (!m) return;
    sheetAlert(
      `Удалить мерчанта «${m.name}»?`,
      `${m.count} ${plural(m.count, ['покупка останется', 'покупки останутся', 'покупок останутся'])} в операциях со своими категориями, но без мерчанта. `
        + 'Новые операции этого мерчанта не будут получать категорию автоматически. Новые SMS от него снова создадут мерчанта.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить мерчанта', style: 'destructive', onPress: () => {
            deleteMerchants([m.id]).then(() => {
              emitTransactionsChanged();
              onChanged();
              onClose();
              toast(`Мерчант «${m.name}» удалён`);
            }).catch((e) => { console.error('delete merchant failed', e); toastError('Не удалось удалить'); });
          },
        },
      ]);
  }

  function showTransactions() {
    if (!m) return;
    onClose();
    onLeave?.();
    // the Transactions tab searching this merchant's name, back returns to the merchants (`as never`: a nested navigate the root types don't describe)
    navigation.navigate({ name: 'Main', params: { screen: 'Transactions', params: { query: m.name, nonce: Date.now(), from: 'Merchants' } } } as never);
  }

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
              <Switch value={mixed} onValueChange={switchMixed} disabled={saving} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.bg} />
            </View>

            {!mixed && m.category_id !== null ? (
              // it has one: shown with "Сменить" (every category in a sheet), as on an operation
              <View style={styles.pickerTop}>
                <SectionHeading title="Категория" />
                <View style={styles.currentRow}>
                  <Chip label={single === null ? 'Без категории' : categories.get(single)?.label ?? '…'} selected />
                  <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setChanging(true)} accessibilityLabel="Сменить категорию">
                    <PencilIcon color={colors.accent} size={16} />
                    <Text style={styles.changeText}>Сменить</Text>
                  </TouchableOpacity>
                </View>
                <CategoryPickerModal
                  visible={changing}
                  title="Сменить категорию"
                  selectedId={single}
                  allowNone
                  onPick={(id) => { setChanging(false); setSingle(id); }}
                  onClose={() => setChanging(false)}
                />
              </View>
            ) : mixed ? (
              // different ones: its categories (✕ takes one off) and "Добавить категорию" (every category in a sheet)
              <View style={styles.pickerTop}>
                <SectionHeading title="Категории мерчанта" />
                <Text style={styles.listHint}>Какие обычно категории у «{m.name}»?</Text>
                <View style={styles.currentRow}>
                  {list.map((id) => (
                    <Chip key={id} label={categories.get(id)?.label ?? '…'} selected trailing="✕" disabled={saving} onPress={() => toggle(id)} />
                  ))}
                  <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setAdding(true)} accessibilityLabel="Добавить категорию">
                    <Text style={styles.changeText}>＋ Добавить категорию</Text>
                  </TouchableOpacity>
                </View>
                {/* several at once: the merchant's ones selected and first, a tap adds or takes one off */}
                <CategoryPickerModal
                  visible={adding}
                  title="Категории мерчанта"
                  selectedIds={list}
                  onPick={(id) => { if (id !== null) toggle(id); }}
                  onClose={() => setAdding(false)}
                />
              </View>
            ) : (
            // none yet: the categories right here, "Без категории" among them
            <View style={styles.pickerTop}>
              <CategoryPicker
                title="Выберите категорию"
                selectedId={single}
                onSelect={toggle}
                allowNone
                disabled={saving}
              />
            </View>
            )}

            <SheetActions
              submit={{ title: 'Сохранить', onPress: save, disabled: !dirty || saving }}
              extra={[{ title: 'Удалить мерчанта', danger: true, onPress: remove }]}
            />
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
  listHint: { fontSize: 14, color: colors.muted, marginBottom: 10 },
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchText: { flex: 1 },
  switchTitle: { fontSize: 16, color: colors.text },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pickerTop: { marginTop: 8 },
});
