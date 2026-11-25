import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SearchIcon } from './icons';
import { colors } from '../theme/theme';
import { font, radius, space } from '../theme/tokens';

/** The text search: a field with ✕ to clear it. */
export default function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <SearchIcon color={colors.muted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityLabel="Очистить поиск"
        >
          <Text style={styles.clear}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space[12],
  },
  input: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: space[8] },
  clear: { fontSize: font.input, color: colors.muted },
});
