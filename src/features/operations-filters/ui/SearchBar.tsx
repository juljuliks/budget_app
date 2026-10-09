import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SearchIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';

/** The text search: a field with ✕ to clear it. */
export default function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
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
        <TouchableOpacity onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Очистить поиск">
          <Text style={styles.clear}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 10, paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
});
