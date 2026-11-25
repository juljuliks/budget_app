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
import { font, radius, space, weight } from '@/shared/theme/tokens';
import Empty from '@/shared/ui/Empty';

/** "Не распознано": bank messages no operation came from, newest first; a tap opens one for marking. */
export default function UnparsedScreen() {
  const navigation = useRootNavigation();
  const [list, setList] = useState<UnparsedMessage[] | null>(null);
  const { failed, started, fail } = useLoadFailed('load unparsed');
  const load = useCallback(() => {
    started();
    listUnparsed().then(setList).catch(fail);
  }, [started, fail]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!list) return <Loading failed={failed} onRetry={load} />;
  return (
    <FlatList
      style={styles.screen}
      data={list}
      keyExtractor={(m) => String(m.id)}
      ListHeaderComponent={<Text style={styles.hint}>{UNPARSED_HINT}</Text>}
      ListEmptyComponent={<Empty>Всё разобрано.</Empty>}
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.row}
          onPress={() => navigation.navigate('UnparsedMessage', { id: item.id })}
        >
          <View style={styles.top}>
            <Text style={[styles.badge, item.source === 'push' && styles.push]}>
              {sourceLabel(item.source, bankOfSender(item.sender).name).toUpperCase()}
            </Text>
            <Text style={styles.time}>
              {formatDay(item.received_at)}, {formatTime(item.received_at)}
            </Text>
          </View>
          <Text style={styles.body} numberOfLines={4}>
            {item.body}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hint: { fontSize: font.secondary, lineHeight: 20, color: colors.muted, padding: space[16], paddingBottom: space[12] },
  row: {
    paddingHorizontal: space[16],
    paddingVertical: space[14],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: space[6],
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    fontSize: font.caption,
    fontWeight: weight.semibold,
    letterSpacing: 0.4,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: space[8],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  push: { color: colors.accentStrong, backgroundColor: colors.accentSoft },
  time: { fontSize: font.meta, color: colors.muted },
  body: { fontSize: font.body, lineHeight: 21, color: colors.text },
});
