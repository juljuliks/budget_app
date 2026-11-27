import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextField from '@/shared/ui/TextField';
import { Controller, UseFormReturn } from 'react-hook-form';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { CategoryFields } from '../model/commands';
import { font, radius, space, weight } from '@/shared/theme/tokens';

type Props = {
  form: UseFormReturn<CategoryFields>;
  emoji: string;
  /** a system category: the name stays */
  locked: boolean;
  onPickEmoji: () => void;
  onClearEmoji: () => void;
  /** "Готово" on the keyboard (undefined: nothing to save yet) */
  onSubmit?: () => void;
};

/** The emoji (a tile opening the grid: one emoji, no typing) and the name in one row. */
export default function CategoryNameField({ form, emoji, locked, onPickEmoji, onClearEmoji, onSubmit }: Props) {
  return (
    <>
      <Text style={formStyles.label}>Название</Text>
      <View style={styles.nameRow}>
        <View>
          {/* eslint-disable-next-line app/text-button -- the emoji field and its ✕: part of the name field */}
          <TouchableOpacity
            accessibilityRole="button"
            style={[formStyles.input, styles.emoji]}
            onPress={onPickEmoji}
            accessibilityLabel={emoji ? `Эмодзи ${emoji}, изменить` : 'Выбрать эмодзи'}
          >
            <Text style={emoji ? styles.emojiText : styles.emojiPlaceholder}>{emoji || '＋'}</Text>
          </TouchableOpacity>
          {/* without an emoji */}
          {emoji ? (
            // eslint-disable-next-line app/text-button -- the emoji field and its ✕: part of the name field
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.emojiClear}
              onPress={onClearEmoji}
              hitSlop={8}
              accessibilityLabel="Убрать эмодзи"
            >
              <Text style={styles.emojiClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Controller
          control={form.control}
          name="name"
          rules={{ validate: (v) => !!v?.trim() || 'Введите название' }}
          render={({ field }) => (
            <TextField
              style={styles.name}
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Например, Спорт"
              maxLength={40}
              editable={!locked}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', gap: space[10] },
  name: { flex: 1 },
  emoji: { width: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  emojiText: { fontSize: font.headline, color: colors.emoji },
  emojiPlaceholder: { fontSize: font.heading, color: colors.muted },
  emojiClear: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiClearText: { color: colors.onAccent, fontSize: font.micro, fontWeight: weight.bold },
});
