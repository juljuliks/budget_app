import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import { colorFromHue, distinctHue, freeCategoryColors } from '@/colors';
import { useRootNavigation } from '@/shared/navigation/navigation';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Chip from '@/shared/ui/Chip';
import ColorPickerSheet from '@/shared/ui/ColorPickerSheet';
import ColorSwatches from '@/shared/ui/ColorSwatches';
import EmojiPicker from '@/shared/ui/EmojiPicker';
import SectionHeading from '@/shared/ui/SectionHeading';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { NO_SECTION } from '@/shared/lib/strings';
import { useCategoryForm } from '../model/useCategoryForm';
import { QUICK_HINT, systemCategoryHint } from '../texts';
import CategoryNameField from './CategoryNameField';
import CategorySummaryRow from './CategorySummaryRow';
import TypeEditModal from './TypeEditModal';

type Props = {
  visible: boolean;
  /** an existing category; undefined = a new one */
  categoryId?: number;
  /** a new category's section (e.g. "Переводы" when created for a transfer) */
  typeId?: number;
  /**
   * the short form ("+" next to a category list anywhere but the categories page): section (existing ones only),
   * emoji and name; the color is automatic. The full form is on the categories page.
   */
  quick?: boolean;
  onClose: () => void;
  /** after saving, with the category's id: a new one is then picked by the screen that opened the sheet */
  onSaved?: (id: number, created: boolean) => void;
  /** «Удалить категорию» (an existing, not system one): the screen that opened the sheet runs the deletion */
  onDelete?: () => void;
};

/**
 * A category in a sheet: create one (from the categories, or "+" next to any category list) or see / edit one —
 * its operations, section, emoji and name, color; delete it. The screen that opened it does the rest with a new
 * category's id (assigns it, selects it, moves operations into it) exactly as when an existing one is picked.
 */
export default function CategorySheet({ visible, categoryId, typeId: initialTypeId, quick, onClose, onSaved, onDelete }: Props) {
  const navigation = useRootNavigation();
  const {
    form, isNew, isDirty, isSubmitting, name, emoji, typeId, color, set, types, loadTypes, taken, systemKind, summary, save,
  } = useCategoryForm({ visible, categoryId, initialTypeId, onClose, onSaved });
  const system = systemKind !== null;
  const [typeOpen, setTypeOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function showOperations() {
    onClose();
    // the Operations tab filtered by this category, back returns to the categories
    navigation.navigate({ name: 'Main', params: { screen: 'Transactions', params: { category: categoryId, nonce: Date.now(), from: 'Categories' } } } as never);
  }

  // the type's shades first: a type reads as one color family on the charts
  const colorOptions = freeCategoryColors(types, typeId, taken, color);
  const typeOptions: Array<[number | null, string]> = [[null, NO_SECTION], ...types.map((t): [number, string] => [t.id, t.name])];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isNew ? 'Новая категория' : 'Категория'} style={styles.sheet}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isNew && summary ? <CategorySummaryRow summary={summary} onShow={showOperations} /> : null}
        {/* types are managed in the settings; a new one can be made right here */}
        <SectionHeading title="Раздел" />
        <View style={styles.chips}>
          {typeOptions.map(([id, label]) => (
            <Chip key={String(id)} label={label} selected={typeId === id} onPress={() => set('typeId', id)} />
          ))}
          {quick ? null : <Chip label="Новый раздел" add onPress={() => setTypeOpen(true)} />}
        </View>

        <CategoryNameField
          form={form}
          emoji={emoji}
          locked={system}
          onPickEmoji={() => setEmojiOpen(true)}
          onClearEmoji={() => set('emoji', '')}
          onSubmit={isNew || isDirty ? save : undefined}
        />
        {system ? <Text style={styles.quickHint}>{systemCategoryHint(systemKind)}</Text> : null}
        {name.trim() ? (
          <Text style={styles.preview}>
            Будет выглядеть так: {categoryLabel({ emoji, name: name.trim(), type_name: types.find((t) => t.id === typeId)?.name })}
          </Text>
        ) : null}

        {quick ? (
          <Text style={styles.quickHint}>{QUICK_HINT}</Text>
        ) : (
          <>
            <Text style={formStyles.label}>Цвет</Text>
            {/* "Авто" generates a color (another one on each press) that no other category has */}
            <ColorSwatches
              options={colorOptions}
              value={color}
              onChange={(c) => set('color', c)}
              onAuto={() => set('color', colorFromHue(distinctHue(taken, color)))}
              // "+": any color of its own in the picker sheet (it then shows among the swatches, selected)
              onCustom={() => setPickerOpen(true)}
            />
          </>
        )}

        <SheetActions
          // a new category: always (it's created); an existing one: greyed until something changed. "Отмена" only next to
          // a single action: with "Удалить категорию" too, three buttons — the sheet closes by swiping down
          submit={{ title: isNew ? 'Создать' : 'Сохранить', onPress: save, disabled: isSubmitting || (!isNew && !isDirty) }}
          extra={isNew || system || !onDelete ? undefined : [{ title: 'Удалить категорию', onPress: onDelete, danger: true }]}
          onCancel={isNew || system ? onClose : undefined}
        />
      </SheetScrollView>

      <EmojiPicker visible={emojiOpen} value={emoji} onPick={(e) => set('emoji', e)} onClose={() => setEmojiOpen(false)} />
      <ColorPickerSheet visible={pickerOpen} value={color} onPick={(c) => set('color', c)} onClose={() => setPickerOpen(false)} />
      <TypeEditModal
        visible={typeOpen}
        types={types}
        onClose={() => setTypeOpen(false)}
        // the new type is selected for this category
        onSaved={(id) => { setTypeOpen(false); set('typeId', id); loadTypes(); }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  preview: { color: colors.muted, marginTop: 6, fontSize: 13 },
  quickHint: { color: colors.muted, marginTop: 14, fontSize: 13, lineHeight: 18 },
});
