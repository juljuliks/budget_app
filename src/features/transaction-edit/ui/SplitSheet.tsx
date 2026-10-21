import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { categoryLabel, listCategories } from '@/db/categories';
import { CategoryPickerModal } from '@/entities/category';
import { merchantLabel, splitOperation, splitParts } from '@/entities/transaction';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { toastFailure } from '@/shared/ui/toast';
import { formatAmount } from '@/shared/lib/format';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import {
  draftFromIds, draftParts, splitDraftOf, splitState, SplitDraft,
} from '../model/splitDraft';
import type { Tx } from '../model/useTransaction';
import SplitBar from './SplitBar';
import SplitRow from './SplitRow';

type Props = {
  visible: boolean;
  tx: Tx;
  onClose: () => void;
  /** categories a long press picked: the split opens on them. Empty: the operation's saved parts. */
  seed?: number[] | null;
};

/**
 * "Разделить по категориям": the operation's own category (first) takes what's left, the others get the amounts typed.
 * "+ Ещё категория" and a category's row open the category list with these ones checked. Saved only while the parts
 * leave something for the first.
 */
export default function SplitSheet({ visible, tx, onClose, seed }: Props) {
  const [draft, setDraft] = useState<SplitDraft>({ own: null, parts: [] });
  const [choosing, setChoosing] = useState(false);
  const [labels, setLabels] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const parts = splitParts(tx) ?? [];
    setDraft(seed && seed.length >= 2 ? draftFromIds(tx.category_id, seed) : splitDraftOf(tx.category_id, parts.slice(1)));
    setChoosing(false);
    listCategories().then((cats) => setLabels(new Map([
      ...parts.map((p) => [p.category_id, p.label] as const),
      ...cats.map((c) => [c.id, categoryLabel(c)] as const),
    ]))).catch(toastFailure('load categories', LOAD_FAILED));
  }, [visible, tx, seed]);

  const state = splitState(tx.amount_minor, tx.currency, draft);
  const label = (id: number | null) => (id === null ? 'Выберите категорию' : labels.get(id) ?? '…');
  const chosen = [draft.own, ...draft.parts.map((p) => p.category_id)].filter((id): id is number => id !== null);
  const save = () => {
    setSaving(true);
    splitOperation(tx.id, draft.own!, draftParts(draft, state))
      .then(onClose)
      .catch(toastFailure('split transaction', 'Не удалось разделить'))
      .finally(() => setSaving(false));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Разделить по категориям" style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sub}>{merchantLabel(tx)} · {formatAmount(tx.amount_minor, tx.currency, tx.kind)}</Text>
        <SplitBar total={tx.amount_minor} amounts={[Math.max(state.rest, 0), ...state.amounts.map((v) => v ?? 0)]} />
        <Text style={styles.heading}>КАТЕГОРИИ</Text>
        <SplitRow index={0} label={label(draft.own)} currency={tx.currency} rest={state.rest} onPickCategory={() => setChoosing(true)} />
        {draft.parts.map((p, i) => (
          <SplitRow
            key={p.category_id}
            index={i + 1}
            label={label(p.category_id)}
            currency={tx.currency}
            text={p.text}
            onText={(text) => setDraft((d) => ({ ...d, parts: d.parts.map((x, k) => (k === i ? { ...x, text } : x)) }))}
            onPickCategory={() => setChoosing(true)}
            onRemove={() => setDraft((d) => ({ ...d, parts: d.parts.filter((_, k) => k !== i) }))}
          />
        ))}
        <TouchableOpacity style={styles.add} onPress={() => setChoosing(true)}>
          <Text style={styles.addText}>+ Ещё категория</Text>
        </TouchableOpacity>
        {state.error
          ? <Text style={styles.error}>{state.error}</Text>
          : <Text style={styles.hint}>Каждая часть считается в своей категории: в плане, статистике и лимитах. Категория мерчанта не меняется.</Text>}
        <SheetActions submit={{ title: 'Сохранить', onPress: save, disabled: !state.canSave || saving }} onCancel={onClose} />
      </SheetScrollView>
      <CategoryPickerModal
        visible={choosing}
        title="Категории"
        selectedIds={chosen}
        severalMin={2}
        onPick={() => undefined}
        onSeveral={(ids) => setDraft((d) => draftFromIds(tx.category_id, ids, d))}
        onClose={() => setChoosing(false)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  sub: { fontSize: 15, color: colors.muted, marginBottom: 16 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 20, marginBottom: 2 },
  add: {
    alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  addText: { fontSize: 15, color: colors.accent },
  error: { fontSize: 14, color: colors.danger, marginTop: 16 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 16, lineHeight: 18 },
});
