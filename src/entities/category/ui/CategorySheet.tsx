import React from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { useCategoryForm } from '../model/useCategoryForm';
import CategoryFields from './CategoryFields';

type Props = {
  visible: boolean;
  /** a new category's section (e.g. "Переводы" when created for a transfer) */
  typeId?: number;
  /**
   * the short form ("+" next to a category list anywhere but the categories page): section (existing ones only),
   * emoji and name; the color is automatic. The full form is on the categories page.
   */
  quick?: boolean;
  onClose: () => void;
  /** after creating it, with its id: it is then picked by the screen that opened the sheet */
  onSaved?: (id: number, created: boolean) => void;
};

/**
 * A new category, in a sheet (from the categories' "＋ Создать", or "+" next to any category list). The screen that
 * opened it does the rest with its id (assigns it, selects it, moves operations into it) exactly as when an existing
 * one is picked. An existing category is a page (CategoryView).
 */
export default function CategorySheet({ visible, typeId: initialTypeId, quick, onClose, onSaved }: Props) {
  const f = useCategoryForm({ visible, initialTypeId, onClose, onSaved });
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новая категория" style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CategoryFields f={f} quick={quick} />
        <SheetActions submit={{ title: 'Создать', onPress: f.save, disabled: f.isSubmitting }} onCancel={onClose} />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
});
