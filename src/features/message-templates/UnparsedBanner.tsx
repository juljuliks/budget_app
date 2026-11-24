import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { countUnparsed } from '@/db/messages';
import { onTransactionsChanged } from '@/domain/events';
import { useRootNavigation } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import { UNPARSED } from './texts';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** Over the operations: "Не распознано: N ›" while bank messages wait for marking; opens their list. */
export default function UnparsedBanner() {
  const navigation = useRootNavigation();
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    countUnparsed()
      .then(setN)
      .catch((e) => console.error('count unparsed failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (n === 0) return null;
  return (
    <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Unparsed')} accessibilityRole="button">
      <View style={styles.flex}>
        <Text style={styles.title}>
          {UNPARSED}: {n}
        </Text>
        <Text style={styles.text}>Сообщения банка без операции — отметьте в них сумму</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    backgroundColor: colors.warnBg,
    borderRadius: radius.md,
    padding: space[12],
    marginBottom: space[8],
  },
  flex: { flex: 1 },
  title: { fontSize: font.body, fontWeight: weight.semibold, color: '#92400E' },
  text: { fontSize: font.meta, color: '#92400E', marginTop: space[2] },
  chevron: { fontSize: 22, color: colors.warn },
});
