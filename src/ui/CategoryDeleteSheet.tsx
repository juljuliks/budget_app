import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Category, categoryLabel, countPastTransactionsOfCategory, currentTransactionsOfCategory, deleteCategory, getCategory,
} from '../db/categories';
import { emitTransactionsChanged } from '../events';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import CategoryPicker from './CategoryPicker';
import { plural } from './format';
import { formatMoneyWithCurrency } from './money';
import { colors } from './theme';
import { useLast } from './useLast';
import { toast, toastError } from './toast';

type Props = {
  /** the category being deleted; null = closed */
  categoryId: number | null;
  onClose: () => void;
};

/**
 * Deleting a category that has operations this month: they all move to another category (or none) — their
 * merchants' categories follow — and the category goes. Past months keep it, so history doesn't change.
 * (One without operations this month is deleted with a plain confirmation, see confirmDeleteCategory.)
 */
export default function CategoryDeleteSheet({ categoryId: openId, onClose }: Props) {
  const categoryId = useLast(openId) ?? -1;
  const visible = openId !== null;
  const [category, setCategory] = useState<Category | null>(null);
  const [current, setCurrent] = useState<Array<{ amount_minor: number; currency: string }>>([]);
  const [past, setPast] = useState(0);
  // where this month's operations go: a category id, null = "Без категории", undefined = not picked yet
  const [target, setTarget] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTarget(undefined);
    setSaving(false);
    Promise.all([getCategory(categoryId), currentTransactionsOfCategory(categoryId), countPastTransactionsOfCategory(categoryId)])
      .then(([c, cur, p]) => { setCategory(c ?? null); setCurrent(cur); setPast(p); })
      .catch((e) => console.error('load category to delete failed', e));
  }, [visible, categoryId]);

  async function remove() {
    if (target === undefined) return;
    setSaving(true);
    try {
      await deleteCategory(categoryId, target);
      emitTransactionsChanged();
      toast(`Категория «${category ? categoryLabel(category) : ''}» удалена`);
      onClose();
    } catch (e) {
      console.error('delete category failed', e);
      toastError('Не удалось удалить');
      setSaving(false);
    }
  }

  // this month's total per currency
  const totals = new Map<string, number>();
  for (const t of current) totals.set(t.currency, (totals.get(t.currency) ?? 0) + t.amount_minor);
  const sum = [...totals].map(([cur, minor]) => formatMoneyWithCurrency(minor, cur)).join(' + ');
  const n = current.length;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Удалить «${category ? categoryLabel(category) : '…'}»`} style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>
          В этом месяце в категории {n} {plural(n, ['операция', 'операции', 'операций'])}{sum ? ` на ${sum}` : ''}.
          Выберите, куда их перенести — туда же перейдут категории их мерчантов. План категории на этот месяц удалится.
          {past > 0 ? ` Прошлые месяцы (${past} ${plural(past, ['операция', 'операции', 'операций'])}) останутся в этой категории и не изменятся.` : ''}
        </Text>
        <View style={styles.picker}>
          <CategoryPicker
            title="Перенести в"
            selectedId={target}
            onSelect={setTarget}
            allowNone
            excludeIds={[categoryId]}
            disabled={saving}
          />
        </View>
        <SheetActions
          submit={{ title: `Перенести и удалить`, danger: true, onPress: remove, disabled: target === undefined || saving }}
          onCancel={onClose}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  picker: { marginTop: 8 },
});
