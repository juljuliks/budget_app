import { WEEKDAYS } from '@/shared/lib/dates';
import TextField from '@/shared/ui/TextField';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Category, categoryLabel, listCategories } from '@/db/categories';
import { CategoryType, listCategoryTypes } from '@/db/categoryTypes';
import { MergeNameTakenError, mergedName, mergePlanPreview, MergeRhythm } from '@/db/mergeCategories';
import { currentYm, planConverter } from '@/db/plans';
import { mergeInto } from './merge';
import { mergePlan, rhythmKey } from './mergePlan';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { formStyles } from '@/shared/theme/formStyles';

import RadioGroup from '@/shared/ui/RadioGroup';
import { NO_SECTION, SPENDING_PATTERN, LOAD_FAILED } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
import { font, space, weight } from '@/shared/theme/tokens';
import Banner from '@/shared/ui/Banner';

// a regular payment within the month: its days ("Регулярный платёж · пн, чт")
const regularDaysText = (r: MergeRhythm) =>
  r.every === 'day'
    ? 'каждый день'
    : [0, 1, 2, 3, 4, 5, 6]
        .filter((i) => ((r.weekdays ?? 0) & (1 << i)) !== 0)
        .map((i) => WEEKDAYS[(i + 1) % 7])
        .join(', ');
const rhythmTitle = (r: MergeRhythm) =>
  r.every
    ? `Регулярный платёж · ${regularDaysText(r)}`
    : r.kind === 'fixed'
      ? 'Разовый платёж'
      : `Лимит · ${SPENDING_PATTERN[r.norm].title.toLowerCase()}`;

/**
 * Merging the categories picked (in the order picked) into the first: its name ("Кафе & Рестораны"), section and
 * how it's planned when theirs differ. The whole history merges — said in the sheet before it's done.
 */
export default function MergeCategoriesSheet({
  ids,
  onClose,
  onMerged,
}: {
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
      const [all, t, items, conv] = await Promise.all([
        listCategories(),
        listCategoryTypes(),
        mergePlanPreview(ids),
        planConverter(currentYm()),
      ]);
      const picked = ids.map((id) => all.find((c) => c.id === id)).filter((c): c is Category => !!c);
      setCats(picked);
      setTypes(t);
      setName(mergedName(picked));
      setTypeKey(picked[0]?.type_id === null || !picked[0] ? 'none' : String(picked[0].type_id));
      const plan = mergePlan(ids, picked, items, conv);
      setPlanSum(plan.sum);
      const ways = plan.ways;
      setRhythms(ways);
      setRhythm(ways[0] ? rhythmKey(ways[0].rhythm) : '');
    })().catch(toastFailure('load merge', LOAD_FAILED));
  }, [visible, ids]);

  // the sections of the categories picked, when they differ
  const typeIds = [...new Set(cats.map((c) => c.type_id))];
  const typeOptions = typeIds.map(
    (id) =>
      [
        id === null ? 'none' : String(id),
        id === null ? NO_SECTION : (types.find((t) => t.id === id)?.name ?? '?'),
      ] as const,
  );
  const others = cats
    .slice(1)
    .map((c) => `«${categoryLabel(c)}»`)
    .join(', ');

  async function merge() {
    if (!name.trim()) {
      toastError('Введите название');
      return;
    }
    setSaving(true);
    const chosen = rhythms.length > 1 ? (rhythms.find((w) => rhythmKey(w.rhythm) === rhythm)?.rhythm ?? null) : null;
    await mergeAndSay(ids, name, typeKey === 'none' ? null : Number(typeKey), chosen, onMerged);
    setSaving(false);
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Объединить ${ids.length} ${ids.length < 5 ? 'категории' : 'категорий'}`}
      style={styles.sheet}
    >
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Название" value={name} onChangeText={setName} maxLength={60} editable={!saving} />
        {typeOptions.length > 1 ? (
          <>
            <Text style={formStyles.label}>Раздел</Text>
            <RadioGroup options={typeOptions} value={typeKey} onChange={setTypeKey} />
          </>
        ) : null}
        {planSum ? (
          <>
            <Text style={formStyles.label}>План на этот месяц</Text>
            <Text style={styles.text}>
              Суммы складываются: <Text style={styles.bold}>{planSum}</Text>
            </Text>
            {rhythms.length > 1 ? (
              <>
                <Text style={formStyles.hint}>Категории запланированы по-разному — как планировать объединённую:</Text>
                <RadioGroup
                  options={rhythms.map(
                    (w) =>
                      [
                        rhythmKey(w.rhythm),
                        rhythmTitle(w.rhythm),
                        `как ${w.names.map((n) => `«${n}»`).join(', ')}`,
                      ] as const,
                  )}
                  value={rhythm}
                  onChange={setRhythm}
                />
              </>
            ) : null}
          </>
        ) : null}
        {/* the history merges: say so before it's done */}
        <Banner
          text={
            <>
              Объединится вся история: операции, мерчанты и планы {others} за все прошлые месяцы перейдут в эту
              категорию — статистика, отчёты и история прошлых месяцев изменятся. Отменить это нельзя.
            </>
          }
          style={styles.warn}
        />
        <SheetActions
          submit={{ title: 'Объединить', onPress: merge, disabled: saving || !name.trim() }}
          onCancel={onClose}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  content: { paddingHorizontal: space[20], paddingBottom: space[8] },
  text: { fontSize: font.body, color: colors.text, lineHeight: 21 },
  bold: { fontWeight: weight.semibold },
  warn: { marginTop: space[16] },
});

/** Merges them; said in a toast — done, the name taken in the section, or failed. */
async function mergeAndSay(
  ids: number[],
  name: string,
  typeId: number | null,
  rhythm: MergeRhythm | null,
  onMerged: () => void,
) {
  try {
    await mergeInto(ids[0], ids.slice(1), name, typeId, rhythm);
    toast(`Категории объединены в «${name.trim()}»`);
    onMerged();
  } catch (e) {
    if (e instanceof MergeNameTakenError) toastError(`Категория «${e.name}» в этом разделе уже есть`);
    else {
      console.error('merge categories failed', e);
      toastError('Не удалось объединить');
    }
  }
}
