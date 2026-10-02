import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Category, categoryLabel, countPastTransactionsOfCategory, currentTransactionsOfCategory, deleteCategory, getCategory, listCategories,
} from '../db/categories';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay } from './format';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDelete'>;
type Tx = Awaited<ReturnType<typeof currentTransactionsOfCategory>>[number];

/**
 * Deleting a category: this month's transactions move to the chosen category;
 * past months keep the deleted one so history doesn't change.
 */
export default function CategoryDelete({ route, navigation }: Props) {
  const { categoryId } = route.params;
  const [category, setCategory] = useState<Category | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [pastCount, setPastCount] = useState(0);
  const [targets, setTargets] = useState<Category[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getCategory(categoryId),
      currentTransactionsOfCategory(categoryId),
      countPastTransactionsOfCategory(categoryId),
      listCategories(),
    ]).then(([c, current, past, all]) => {
      setCategory(c ?? null);
      setTxs(current);
      setPastCount(past);
      // a transfer category's transactions are transfers: offer transfer categories first
      const others = all.filter((x) => x.id !== categoryId);
      const sameKind = others.filter((x) => x.type_is_transfer === c?.type_is_transfer);
      setTargets([...sameKind, ...others.filter((x) => !sameKind.includes(x))]);
    }).catch((e) => console.error('load category delete failed', e));
  }, [categoryId]);

  async function confirm() {
    setSaving(true);
    try {
      await deleteCategory(categoryId, target);
      emitTransactionsChanged();
      navigation.goBack();
    } catch (e) {
      console.error('delete category failed', e);
      setSaving(false);
    }
  }

  if (!category || !txs) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Удалить «{categoryLabel(category)}»?</Text>

      {txs.length > 0 ? (
        <>
          <Text style={styles.heading}>Транзакции этого месяца ({txs.length})</Text>
          {txs.map((t) => (
            <View key={t.id} style={styles.txRow}>
              <Text style={styles.txName} numberOfLines={1}>{t.raw_merchant || 'Без мерчанта'}</Text>
              <Text style={styles.txMeta}>{formatDay(t.occurred_at)}</Text>
              <Text style={styles.txAmount}>{formatAmount(t.amount_minor, t.currency, t.kind)}</Text>
            </View>
          ))}

          <Text style={styles.heading}>Перенести их в категорию</Text>
          <View style={styles.chips}>
            {targets.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, target === c.id && styles.chipOn]} onPress={() => setTarget(c.id)}>
                <Text style={[styles.chipText, target === c.id && styles.chipTextOn]}>{categoryLabel(c)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, target === null && styles.chipOn]} onPress={() => setTarget(null)}>
              <Text style={[styles.chipText, target === null && styles.chipTextOn]}>Оставить без категории</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={styles.hint}>В этом месяце транзакций в этой категории нет.</Text>
      )}

      {pastCount > 0 ? (
        <Text style={styles.hint}>
          {pastCount} транзакц. за прошлые месяцы останутся в «{category.name}» — история и статистика прошлых месяцев не изменятся.
        </Text>
      ) : null}
      <Text style={styles.hint}>Правила для мерчантов перейдут в выбранную категорию, пункт плана текущего месяца будет удалён.</Text>

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={confirm}>
        <Text style={styles.buttonText}>
          {txs.length > 0 && target !== null ? 'Перенести и удалить' : 'Удалить'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '600', color: colors.text },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  txName: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  txMeta: { fontSize: 13, color: colors.muted, marginRight: 8 },
  txAmount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent },
  chipText: { fontSize: 15, color: colors.text },
  chipTextOn: { color: '#FFFFFF' },
  hint: { color: colors.muted, marginTop: 12, fontSize: 13 },
  button: { marginTop: 24, backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
