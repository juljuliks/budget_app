import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Category, categoryLabel, deleteCategory, getCategory } from '../db/categories';
import { categoryDeletePreview, DeletePreview } from '../db/categoryDeletion';
import { emitTransactionsChanged } from '../events';
import { navigationRef } from '@/shared/navigation/navigation';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import Button, { SheetActions } from '@/shared/ui/Button';
import CategoryPickerModal from './CategoryPickerModal';
import { deleteStartText, moveAllText } from './categoryDeletionText';
import { plural } from '@/shared/lib/format';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { colors } from '@/shared/theme/theme';
import { useLast } from '@/shared/lib/useLast';
import { toast, toastError } from '@/shared/ui/toast';

type Props = {
  /** the category being deleted; null = closed */
  categoryId: number | null;
  onClose: () => void;
};

/**
 * Deleting a category that has operations this month: they go first — all to one category (a picker, then a
 * confirmation of what moves and what stays), or sorted out to several in the operations list (grouped by merchant,
 * locked to this category and month; it offers the delete when nothing is left). Past months keep the category.
 * (One without operations this month is deleted with a plain confirmation, see confirmDeleteCategory.)
 */
export default function CategoryDeleteSheet({ categoryId: openId, onClose }: Props) {
  const categoryId = useLast(openId) ?? -1;
  const visible = openId !== null;
  const [category, setCategory] = useState<Category | null>(null);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPicking(false);
    setSaving(false);
    Promise.all([getCategory(categoryId), categoryDeletePreview(categoryId)])
      .then(([c, p]) => { setCategory(c ?? null); setPreview(p); })
      .catch((e) => console.error('load category to delete failed', e));
  }, [visible, categoryId]);

  const label = category ? categoryLabel(category) : '…';

  // one category for all: what moves and what stays, then the delete
  async function confirmMoveAll(target: number | null) {
    setPicking(false);
    if (!preview) return;
    const to = target === null ? null : await getCategory(target);
    const t = moveAllText(label, to ? categoryLabel(to) : null, preview);
    sheetAlert(t.title, t.message, [
      { text: 'Отмена', style: 'cancel' },
      { text: target === null ? 'Удалить' : 'Перенести и удалить', style: 'destructive', onPress: () => { remove(target).catch(() => undefined); } },
    ]);
  }

  async function remove(target: number | null) {
    setSaving(true);
    try {
      await deleteCategory(categoryId, target);
      emitTransactionsChanged();
      toast(`Категория «${label}» удалена`);
      onClose();
    } catch (e) {
      console.error('delete category failed', e);
      toastError('Не удалось удалить');
    } finally {
      setSaving(false);
    }
  }

  // several: the operations list, sorting out (back returns to the categories)
  function sortOut() {
    onClose();
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Main', { screen: 'Transactions', params: { sortOut: categoryId, nonce: Date.now(), from: 'Categories' } } as never);
  }

  const n = preview?.current.n ?? 0;
  return (
    <>
      <BottomSheet visible={visible && !picking} onClose={onClose} title={`Удалить «${label}»`} style={styles.sheet}>
        <SheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.text} testID="delete-category-text">{preview ? deleteStartText(preview, label) : ''}</Text>
          <View style={styles.buttons}>
            <Button title={n === 1 ? "Перенести в другую категорию" : "Перенести всё в одну категорию"} onPress={() => setPicking(true)} disabled={!preview || saving} testID="delete-move-all" />
            {n > 1 ? <Button title="Разложить по разным категориям" outline onPress={sortOut} disabled={saving} testID="delete-sort-out" /> : null}
          </View>
          <SheetActions submit={null} onCancel={onClose} />
        </SheetScrollView>
      </BottomSheet>
      <CategoryPickerModal
        visible={visible && picking}
        title={`Куда перенести ${n} ${plural(n, ['операцию', 'операции', 'операций'])}`}
        allowNone
        excludeIds={[categoryId]}
        saveTitle="Сохранить"
        onPick={(id) => { confirmMoveAll(id).catch((e) => console.error('confirm move failed', e)); }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  buttons: { gap: 10, marginTop: 16 },
});
