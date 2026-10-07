import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Category, categoryLabel, listCategories } from '../db/categories';
import { CategoryType, listCategoryTypes } from '../db/categoryTypes';
import { mergeCategories, MergeNameTakenError, mergedName, mergePlanPreview, MergeRhythm } from '../db/mergeCategories';
import { currentYm, planConverter } from '../db/plans';
import { emitTransactionsChanged } from '../events';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import { formStyles } from './formStyles';
import { formatWithCurrency } from './money';
import RadioGroup from './RadioGroup';
import { NO_SECTION, SPENDING_PATTERN } from './strings';
import { colors } from './theme';
import { toast, toastError } from './toast';

const rhythmKey = (r: MergeRhythm) => `${r.kind}:${r.norm}`;
const rhythmTitle = (r: MergeRhythm) => (r.kind === 'fixed' ? 'Обязательный платёж' : `Лимит · ${SPENDING_PATTERN[r.norm].title.toLowerCase()}`);

/**
 * Merging the categories picked (in the order picked) into the first: its name ("Кафе & Рестораны"), section and
 * how it's planned when theirs differ. The whole history merges — said in the sheet before it's done.
 */
export default function MergeCategoriesSheet({ ids, onClose, onMerged }: {
  /** the categories picked, the first is merged into; empty = closed */
  ids: number[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const visible = ids.length > 1;
  const [cats, setCats] = useState<Category[]>([]);
  const [types, setTypes] = useState<CategoryType[]>([]);
  const [name, setName] = useState('');
  const [typeKey, setTypeKey] = useState('none');
  // this month's plan: the summed amount, the different ways the categories are planned
  const [planSum, setPlanSum] = useState<string | null>(null);
  const [rhythms, setRhythms] = useState<Array<{ rhythm: MergeRhythm; names: string[] }>>([]);
  const [rhythm, setRhythm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [all, t, items, conv] = await Promise.all([listCategories(), listCategoryTypes(), mergePlanPreview(ids), planConverter(currentYm())]);
      const picked = ids.map((id) => all.find((c) => c.id === id)).filter((c): c is Category => !!c);
      setCats(picked);
      setTypes(t);
      setName(mergedName(picked));
      setTypeKey(picked[0]?.type_id === null || !picked[0] ? 'none' : String(picked[0].type_id));
      // the sum in the target's plan currency (else the first item's), as the merge stores it
      const own = items.find((i) => i.category_id === ids[0]) ?? items[0];
      if (own) {
        const sum = items.reduce((a, i) => a + (i.currency === own.currency ? i.limit_minor : conv(i.limit_minor, i.currency, own.currency) ?? i.limit_minor), 0);
        setPlanSum(formatWithCurrency(Math.round(sum), own.currency));
      } else setPlanSum(null);
      const ways: Array<{ rhythm: MergeRhythm; names: string[] }> = [];
      for (const id of ids) {
        const i = items.find((x) => x.category_id === id);
        if (!i) continue;
        const r: MergeRhythm = { kind: i.kind, norm: i.kind === 'fixed' ? 'month' : i.norm_period };
        const c = picked.find((x) => x.id === id);
        const way = ways.find((w) => rhythmKey(w.rhythm) === rhythmKey(r));
        if (way) way.names.push(c?.name ?? '');
        else ways.push({ rhythm: r, names: [c?.name ?? ''] });
      }
      setRhythms(ways);
      setRhythm(ways[0] ? rhythmKey(ways[0].rhythm) : '');
    })().catch((e) => console.error('load merge failed', e));
  }, [visible, ids]);

  // the sections of the categories picked, when they differ
  const typeIds = [...new Set(cats.map((c) => c.type_id))];
  const typeOptions = typeIds.map((id) => [id === null ? 'none' : String(id), id === null ? NO_SECTION : types.find((t) => t.id === id)?.name ?? '?'] as const);
  const others = cats.slice(1).map((c) => `«${categoryLabel(c)}»`).join(', ');

  async function merge() {
    if (!name.trim()) { toastError('Введите название'); return; }
    setSaving(true);
    try {
      const chosen = rhythms.length > 1 ? rhythms.find((w) => rhythmKey(w.rhythm) === rhythm)?.rhythm ?? null : null;
      await mergeCategories(ids[0], ids.slice(1), name, typeKey === 'none' ? null : Number(typeKey), chosen);
      toast(`Категории объединены в «${name.trim()}»`);
      emitTransactionsChanged();
      onMerged();
    } catch (e) {
      if (e instanceof MergeNameTakenError) toastError(`Категория «${e.name}» в этом разделе уже есть`);
      else { console.error('merge categories failed', e); toastError('Не удалось объединить'); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Объединить ${ids.length} ${ids.length < 5 ? 'категории' : 'категорий'}`} style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={formStyles.label}>Название</Text>
        <TextInput
          style={formStyles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.muted}
          maxLength={60}
          editable={!saving}
        />
        {typeOptions.length > 1 ? (
          <>
            <Text style={formStyles.label}>Раздел</Text>
            <RadioGroup options={typeOptions} value={typeKey} onChange={setTypeKey} />
          </>
        ) : null}
        {planSum ? (
          <>
            <Text style={formStyles.label}>План на этот месяц</Text>
            <Text style={styles.text}>Суммы складываются: <Text style={styles.bold}>{planSum}</Text></Text>
            {rhythms.length > 1 ? (
              <>
                <Text style={formStyles.hint}>Категории запланированы по-разному — как планировать объединённую:</Text>
                <RadioGroup
                  options={rhythms.map((w) => [rhythmKey(w.rhythm), rhythmTitle(w.rhythm), `как ${w.names.map((n) => `«${n}»`).join(', ')}`] as const)}
                  value={rhythm}
                  onChange={setRhythm}
                />
              </>
            ) : null}
          </>
        ) : null}
        {/* the history merges: say so before it's done */}
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Объединится вся история: операции, мерчанты и планы {others} за все прошлые месяцы перейдут в эту категорию —
            статистика, отчёты и история прошлых месяцев изменятся. Отменить это нельзя.
          </Text>
        </View>
        <SheetActions submit={{ title: 'Объединить', onPress: merge, disabled: saving || !name.trim() }} onCancel={onClose} />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bold: { fontWeight: '600' },
  warn: { marginTop: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.warnBg },
  warnText: { fontSize: 14, color: colors.warn, lineHeight: 20 },
});
