import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryInfo, CategoryPickerModal } from '@/entities/category';
import SectionHeading from '@/shared/ui/SectionHeading';
import { PencilIcon } from '@/shared/ui/icons';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import MerchantCategoryList from './MerchantCategoryList';

type Props = {
  merchantId: string;
  categories: Map<number, CategoryInfo>;
  mixed: boolean;
  single: number | null;
  list: number[];
  saving: boolean;
  chooseOne: (id: number | null) => void;
  chooseSeveral: (ids: number[]) => void;
  addIds: (ids: number[]) => void;
  moveCategory: (from: number, to: number) => void;
  removeCategory: (index: number) => void;
  /** the page stops scrolling while a row is dragged */
  onOrderingChange: (on: boolean) => void;
};

/** "Сменить" or "Добавить", right of the title. */
function SideButton({ label, accessibilityLabel, disabled, plus, onPress }: {
  label: string; accessibilityLabel: string; disabled: boolean; plus?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.changeButton} disabled={disabled} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      {plus ? <Text style={styles.plus}>＋</Text> : <PencilIcon color={colors.accent} size={16} />}
      <Text style={styles.changeText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * The merchant's categories, as rows of "Сменить категорию". One (or none): "Сменить". Several: the first has a star
 * in its color (the rest a dot) and is the primary category, "Добавить" appends, a trash takes one off. A long press drags
 * (a grip, no trash); "Готово" brings the star and the trash back.
 * The page's "Сохранить" writes it.
 */
export default function MerchantCategories(p: Props) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const ids = p.mixed && p.list.length ? p.list : p.single !== null ? [p.single] : [];
  const several = ids.length > 1;
  const onOrderingChange = p.onOrderingChange;
  const setMode = (on: boolean) => { setOrdering(on); onOrderingChange(on); };
  useEffect(() => {
    setOrdering(false);
    onOrderingChange(false);
    setChanging(false);
    setAdding(false);
  }, [p.merchantId, onOrderingChange]);
  useEffect(() => {
    if (several) return;
    setOrdering(false);
    onOrderingChange(false);
  }, [several, onOrderingChange]);

  const label = (id: number) => p.categories.get(id)?.label ?? '…';
  const color = (id: number) => p.categories.get(id)?.color ?? colors.border;
  const close = () => { setChanging(false); setAdding(false); };

  return (
    <View style={styles.pickerTop}>
      <SectionHeading
        title="Категория"
        right={ordering
          ? (
            <TouchableOpacity style={styles.done} onPress={() => setMode(false)} accessibilityRole="button">
              <Text style={styles.doneText}>Готово</Text>
            </TouchableOpacity>
          )
          : several
            ? <SideButton label="Добавить" accessibilityLabel="Добавить категорию" disabled={p.saving} plus onPress={() => setAdding(true)} />
            : <SideButton label="Сменить" accessibilityLabel="Сменить категорию" disabled={p.saving} onPress={() => setChanging(true)} />}
      />
      {several && !ordering ? <Text style={styles.hint}>Зажмите, чтобы сменить порядок.</Text> : null}
      {ids.length ? (
        <MerchantCategoryList
          ids={ids}
          label={label}
          color={color}
          ordering={ordering}
          onLongPress={() => { if (several) setMode(true); }}
          onReorder={p.moveCategory}
          onRemove={p.removeCategory}
        />
      ) : (
        <Text style={styles.none}>{NO_CATEGORY}</Text>
      )}
      <CategoryPickerModal
        visible={changing || adding}
        title={adding ? 'Добавить категорию' : 'Сменить категорию'}
        selectedId={adding ? null : ids.length === 1 ? ids[0] : null}
        keepSelected={!adding && ids.length === 1}
        excludeIds={adding ? ids : undefined}
        allowNone={!adding}
        onPick={(id) => { if (adding) { if (id !== null) p.addIds([id]); } else p.chooseOne(id); close(); }}
        onSeveral={(picked) => { if (adding) p.addIds(picked); else p.chooseSeveral(picked); close(); }}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerTop: { marginTop: 8 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  none: { fontSize: 18, color: colors.text, paddingVertical: 8 },
  changeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  plus: { fontSize: 16, color: colors.accent, lineHeight: 18 },
  done: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.accent },
  doneText: { fontSize: 15, color: colors.onAccent, fontWeight: '600' },
});
