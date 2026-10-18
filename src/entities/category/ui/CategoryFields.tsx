import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import { colorFromHue, distinctHue, freeCategoryColors } from '@/domain/colors';
import Chip from '@/shared/ui/Chip';
import ColorPickerSheet from '@/shared/ui/ColorPickerSheet';
import ColorSwatches from '@/shared/ui/ColorSwatches';
import EmojiPicker from '@/shared/ui/EmojiPicker';
import SectionHeading from '@/shared/ui/SectionHeading';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { NO_SECTION } from '@/shared/lib/strings';
import type { useCategoryForm } from '../model/useCategoryForm';
import { QUICK_HINT, systemCategoryHint } from '../texts';
import CategoryNameField from './CategoryNameField';
import TypeEditModal from './TypeEditModal';

/** Colors offered at once; any other — "+" (the picker). */
const COLORS_SHOWN = 6;

type Props = {
  f: ReturnType<typeof useCategoryForm>;
  /** the short form (a new category from a picker): existing sections only, the color automatic */
  quick?: boolean;
};

/**
 * A category's fields, on its page and in the new category's sheet: the section (a new one right here), the emoji and
 * name ("Будет выглядеть так"), the color — 6 offered, "Авто", "+" any.
 */
export default function CategoryFields({ f, quick }: Props) {
  const { form, isNew, isDirty, name, emoji, typeId, color, set, types, loadTypes, taken, systemKind, save } = f;
  const system = systemKind !== null;
  const [typeOpen, setTypeOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // the type's shades first: a type reads as one color family on the charts; the current one always among them
  const offered = freeCategoryColors(types, typeId, taken, color).slice(0, COLORS_SHOWN);
  const colorOptions = color && !offered.includes(color) ? [color, ...offered.slice(0, COLORS_SHOWN - 1)] : offered;
  const typeOptions: Array<[number | null, string]> = [[null, NO_SECTION], ...types.map((t): [number, string] => [t.id, t.name])];

  return (
    <>
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
      {system ? <Text style={styles.hint}>{systemCategoryHint(systemKind)}</Text> : null}
      {name.trim() ? (
        <Text style={styles.preview}>
          Будет выглядеть так: {categoryLabel({ emoji, name: name.trim(), type_name: types.find((t) => t.id === typeId)?.name })}
        </Text>
      ) : null}

      {quick ? (
        <Text style={styles.hint}>{QUICK_HINT}</Text>
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

      <EmojiPicker visible={emojiOpen} value={emoji} onPick={(e) => set('emoji', e)} onClose={() => setEmojiOpen(false)} />
      <ColorPickerSheet visible={pickerOpen} value={color} onPick={(c) => set('color', c)} onClose={() => setPickerOpen(false)} />
      <TypeEditModal
        visible={typeOpen}
        types={types}
        onClose={() => setTypeOpen(false)}
        // the new type is selected for this category
        onSaved={(id) => { setTypeOpen(false); set('typeId', id); loadTypes(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  preview: { color: colors.muted, marginTop: 6, fontSize: 13 },
  hint: { color: colors.muted, marginTop: 14, fontSize: 13, lineHeight: 18 },
});
