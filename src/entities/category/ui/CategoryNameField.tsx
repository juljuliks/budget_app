import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Controller, UseFormReturn } from 'react-hook-form';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { CategoryFields } from '../model/commands';

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
          <TouchableOpacity style={[formStyles.input, styles.emoji]} onPress={onPickEmoji} accessibilityLabel={emoji ? `Эмодзи ${emoji}, изменить` : 'Выбрать эмодзи'}>
            <Text style={emoji ? styles.emojiText : styles.emojiPlaceholder}>{emoji || '＋'}</Text>
          </TouchableOpacity>
          {/* without an emoji */}
          {emoji ? (
            <TouchableOpacity style={styles.emojiClear} onPress={onClearEmoji} hitSlop={8} accessibilityLabel="Убрать эмодзи">
              <Text style={styles.emojiClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Controller
          control={form.control}
          name="name"
          rules={{ validate: (v) => !!v?.trim() || 'Введите название' }}
          render={({ field }) => (
            <TextInput
              style={[formStyles.input, styles.name]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Например, Спорт"
              placeholderTextColor={colors.muted}
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
  nameRow: { flexDirection: 'row', gap: 10 },
  name: { flex: 1 },
  emoji: { width: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  emojiText: { fontSize: 24, color: '#000000' },
  emojiPlaceholder: { fontSize: 22, color: colors.muted },
  emojiClear: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  emojiClearText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
