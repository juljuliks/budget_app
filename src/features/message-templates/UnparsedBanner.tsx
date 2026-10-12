import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { countUnparsed } from '@/db/messages';
import { onTransactionsChanged } from '@/domain/events';
import { useRootNavigation } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import { UNPARSED } from './texts';

/** Over the operations: "Не распознано: N ›" while bank messages wait for marking; opens their list. */
export default function UnparsedBanner() {
  const navigation = useRootNavigation();
  const [n, setN] = useState(0);
  const load = useCallback(() => { countUnparsed().then(setN).catch((e) => console.error('count unparsed failed', e)); }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (n === 0) return null;
  return (
    <TouchableOpacity style={styles.box} onPress={() => navigation.navigate('Unparsed')} accessibilityRole="button">
      <View style={styles.flex}>
        <Text style={styles.title}>{UNPARSED}: {n}</Text>
        <Text style={styles.text}>Сообщения банка без операции — отметьте в них сумму</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.warnBg, borderRadius: 10, padding: 12, marginBottom: 8 },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#92400E' },
  text: { fontSize: 13, color: '#92400E', marginTop: 2 },
  chevron: { fontSize: 22, color: colors.warn },
});
