import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CategoryType, createCategoryType, findCategoryTypeByName, renameCategoryType, setCategoryTypePalette,
} from '../db/categoryTypes';
import {
  colorFromHue, distinctHue, freePalettes, hexToHsl, isCustomPalette, PALETTES, paletteShades, typePalette,
} from '../colors';
import { emitTransactionsChanged } from '../events';
import { PaletteStrip } from './ColorSwatches';
import { formStyles } from './formStyles';
import HueBar from './HueBar';
import TextInputModal from './TextInputModal';
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
  const [palette, setPalette] = useState<string>('blue');

  const others = types.filter((t) => t.id !== type?.id);
  const presets = freePalettes(types, type?.id ?? -1);

  useEffect(() => {
    if (!visible) return;
    const index = type ? types.findIndex((t) => t.id === type.id) : -1;
    // an existing type keeps its palette; a new one starts with the first free preset
    setPalette(type ? typePalette(type, index) : presets[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type?.id]);

  async function save(name: string): Promise<string | null> {
    if (await findCategoryTypeByName(name, type?.id)) return 'Такой тип уже есть';
    let id = type?.id;
    if (id === undefined) id = await createCategoryType(name);
    else await renameCategoryType(id, name);
    await setCategoryTypePalette(id, palette);
    emitTransactionsChanged();
    onSaved(id);
    return null;
  }

  function randomPalette() {
    // away from the base colors of the palettes the other types use
    setPalette(colorFromHue(distinctHue(others.map((t, i) => paletteShades(typePalette(t, i))[0]), palette)));
  }

  const custom = isCustomPalette(palette);

  return (
    <TextInputModal
      visible={visible}
      title={type ? 'Тип' : 'Новый тип'}
      initialValue={type?.name ?? ''}
      placeholder="Например, Хобби"
      submitLabel={type ? 'Сохранить' : 'Создать'}
      onSubmit={save}
      onClose={onClose}
    >
      <Text style={formStyles.label}>Цвета</Text>
      <View style={styles.presets}>
        {presets.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.preset, palette === k && styles.selected]}
            onPress={() => setPalette(k)}
            accessibilityLabel={`Палитра ${PALETTES[k].label}`}
            accessibilityState={{ selected: palette === k }}
          >
            <PaletteStrip shades={PALETTES[k].shades} size={14} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.customHead}>
        <Text style={styles.customLabel}>Своя палитра</Text>
        <TouchableOpacity onPress={randomPalette} hitSlop={8}>
          <Text style={styles.link}>🎲 Случайная</Text>
        </TouchableOpacity>
      </View>
      <HueBar hue={custom ? Math.round(hexToHsl(palette)[0]) : null} onChange={(h) => setPalette(colorFromHue(h))} />
      {custom ? (
        <View style={[styles.preset, styles.selected, styles.customPreview]}>
          <PaletteStrip shades={paletteShades(palette)} size={18} />
        </View>
      ) : null}
    </TextInputModal>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { padding: 6, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  selected: { borderColor: colors.accent },
  customHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  customLabel: { fontSize: 14, color: colors.text },
  link: { fontSize: 14, color: colors.accent },
  customPreview: { alignSelf: 'flex-start', marginTop: 4 },
});
