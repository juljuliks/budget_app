import React, { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CategoryType, createCategoryType, findCategoryTypeByName, renameCategoryType, setCategoryTypePalette,
} from '../db/categoryTypes';
import {
  colorFromHue, distinctHue, freePalettes, isCustomPalette, PALETTES, paletteShades, typePalette,
} from '../colors';
import { emitTransactionsChanged } from '../events';
import { AutoButton, PaletteStrip } from './ColorSwatches';
import { formStyles } from './formStyles';
import ColorPickerSheet from './ColorPickerSheet';
import TextInputModal, { setField } from './TextInputModal';
import { useLoadedForm } from './form';
import { colors } from './theme';

type Props = {
  visible: boolean;
  /** undefined = create a type */
  type?: CategoryType;
  /** all types, in display order (palettes other types use are not offered) */
  types: CategoryType[];
  onClose: () => void;
  /** after saving, with the type's id (a new one is selected by the category editor) */
  onSaved: (id: number) => void;
};

/**
 * Create / edit a category type: its name and its palette — a preset (only those no other type has) or one of
 * the user's own, built from a hue (picked on the rainbow bar or generated away from the colors in use).
 */
export default function TypeEditModal({ visible, type, types, onClose, onSaved }: Props) {
  const others = types.filter((t) => t.id !== type?.id);
  const presets = freePalettes(types, type?.id ?? -1);

  // the name and the palette: an existing type's saved ones, a new one starts with the first free preset
  const form = useLoadedForm<{ value: string; palette: string }>(visible ? {
    value: type?.name ?? '',
    palette: type ? typePalette(type, types.findIndex((t) => t.id === type.id)) : presets[0],
  } : null, visible);
  const palette = useWatch({ control: form.control, name: 'palette' }) ?? presets[0];
  const setPalette = (p: string) => setField(form, 'palette', p);

  async function save(name: string): Promise<string | null> {
    if (await findCategoryTypeByName(name, type?.id)) return 'Такой раздел уже есть';
    let id = type?.id;
    if (id === undefined) id = await createCategoryType(name);
    else await renameCategoryType(id, name);
    await setCategoryTypePalette(id, form.getValues('palette'));
    emitTransactionsChanged();
    onSaved(id);
    return null;
  }

  function randomPalette() {
    // away from the base colors of the palettes the other types use
    setPalette(colorFromHue(distinctHue(others.map((t, i) => paletteShades(typePalette(t, i))[0]), palette)));
  }

  const custom = isCustomPalette(palette);
  // "Авто", 4 palettes and "+": two rows of three. Its own palette takes the first place; a selected preset further
  // down the list takes the last one (the order stays put while picking among the shown ones)
  const SHOWN = 4;
  const first = presets.slice(0, custom ? SHOWN - 1 : SHOWN);
  const shownPresets = !custom && presets.includes(palette as never) && !first.includes(palette as never)
    ? [...first.slice(0, SHOWN - 1), palette as typeof presets[number]]
    : first;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <TextInputModal
      visible={visible}
      title={type ? 'Раздел' : 'Новый раздел'}
      form={form}
      placeholder="Например, Хобби"
      submitLabel={type ? 'Сохранить' : 'Создать'}
      onSubmit={save}
      onClose={onClose}
    >
      <Text style={formStyles.label}>Цвета</Text>
      <View style={styles.presets}>
        {/* "Авто": a generated palette (another one on each press), away from the other types' colors */}
        <AutoButton onPress={randomPalette} style={styles.autoTile} accessibilityLabel="Палитра автоматически" />
        {/* a palette of its own ("Авто" or the "+" picker): first among the offered ones, selected */}
        {custom ? (
          <View style={[styles.preset, styles.selected]} accessibilityLabel="Своя палитра" accessibilityState={{ selected: true }}>
            <PaletteStrip shades={paletteShades(palette)} size={11} />
          </View>
        ) : null}
        {shownPresets.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.preset, palette === k && styles.selected]}
            onPress={() => setPalette(k)}
            accessibilityLabel={`Палитра ${PALETTES[k].label}`}
            accessibilityState={{ selected: palette === k }}
          >
            <PaletteStrip shades={PALETTES[k].shades} size={11} />
          </TouchableOpacity>
        ))}
        {/* "+": a palette of one's own, from a base color picked in the color picker (the shades follow) */}
        <TouchableOpacity style={[styles.preset, styles.createTile]} onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Создать палитру">
          <Text style={styles.createText} numberOfLines={1}>＋ Создать</Text>
        </TouchableOpacity>
      </View>
      <ColorPickerSheet visible={pickerOpen} title="Своя палитра" value={custom ? palette : null} onPick={setPalette} onClose={() => setPickerOpen(false)} />
    </TextInputModal>
  );
}

const styles = StyleSheet.create({
  // three in a row
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    width: '31.5%', height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface,
  },
  autoTile: { width: '31.5%' },
  selected: { borderColor: colors.accent },
  // a palette tile's size, its border in the accent
  createTile: { borderColor: colors.accent, borderWidth: 1, backgroundColor: colors.bg, paddingHorizontal: 6 },
  createText: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
