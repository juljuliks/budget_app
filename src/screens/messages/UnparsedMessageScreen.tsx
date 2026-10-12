import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getUnparsed, UnparsedMessage } from '@/db/messages';
import { MarkMessage, sourceLabel } from '@/features/message-templates';
import { formatDay, formatTime } from '@/shared/lib/format';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import type { RootStackParamList } from '@/shared/navigation/navigation';
import Loading from '@/shared/ui/Loading';
import { colors } from '@/shared/theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UnparsedMessage'>;

/** One message of "Не распознано", marked: its source and time in the header; gone (read meanwhile) — said so. */
export default function UnparsedMessageScreen({ route, navigation }: Props) {
  const [message, setMessage] = useState<UnparsedMessage | null | undefined>(undefined);
  const { failed, started, fail } = useLoadFailed('load unparsed message');
  const load = useCallback(() => {
    started();
    getUnparsed(route.params.id).then((m) => setMessage(m ?? null)).catch(fail);
  }, [route.params.id, started, fail]);
  useEffect(load, [load]);
  useEffect(() => {
    if (message) navigation.setOptions({ title: `${sourceLabel(message.source)} · ${formatDay(message.received_at)}, ${formatTime(message.received_at)}` });
  }, [message, navigation]);

  if (message === null) return <Text style={styles.gone}>Этого сообщения уже нет: его разобрал шаблон или прошло 30 дней.</Text>;
  if (!message) return <Loading failed={failed} onRetry={load} />;
  return <MarkMessage message={message} onDone={() => navigation.goBack()} />;
}

const styles = StyleSheet.create({
  gone: { fontSize: 15, color: colors.muted, textAlign: 'center', padding: 32, backgroundColor: colors.bg, flex: 1 },
});
