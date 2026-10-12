import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { bankOfSender } from '@/domain/banks';
import { listUnparsed, UnparsedMessage } from '@/db/messages';
import { onTransactionsChanged } from '@/domain/events';
import { sourceLabel, UNPARSED_HINT } from '@/features/message-templates';
import { formatDay, formatTime } from '@/shared/lib/format';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import { useRootNavigation } from '@/shared/navigation/navigation';
import Loading from '@/shared/ui/Loading';
import { colors } from '@/shared/theme/theme';

/** "Не распознано": bank messages no operation came from, newest first; a tap opens one for marking. */
export default function UnparsedScreen() {
  const navigation = useRootNavigation();
  const [list, setList] = useState<UnparsedMessage[] | null>(null);
  const { failed, started, fail } = useLoadFailed('load unparsed');
  const load = useCallback(() => { started(); listUnparsed().then(setList).catch(fail); }, [started, fail]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!list) return <Loading failed={failed} onRetry={load} />;
  return (
    <FlatList
      style={styles.screen}
      data={list}
      keyExtractor={(m) => String(m.id)}
      ListHeaderComponent={<Text style={styles.hint}>{UNPARSED_HINT}</Text>}
      ListEmptyComponent={<Text style={styles.empty}>Всё разобрано.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('UnparsedMessage', { id: item.id })}>
          <View style={styles.top}>
            <Text style={[styles.badge, item.source === 'push' && styles.push]}>{sourceLabel(item.source, bankOfSender(item.sender).name).toUpperCase()}</Text>
            <Text style={styles.time}>{formatDay(item.received_at)}, {formatTime(item.received_at)}</Text>
          </View>
          <Text style={styles.body} numberOfLines={4}>{item.body}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted, padding: 16, paddingBottom: 12 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', padding: 32 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, color: '#374151', backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  push: { color: '#1D4ED8', backgroundColor: '#DBEAFE' },
  time: { fontSize: 13, color: colors.muted },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
});
