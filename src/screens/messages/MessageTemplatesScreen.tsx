import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listTemplates, MessageTemplate } from '@/db/messages';
import { bankById } from '@/domain/banks';
import { onTransactionsChanged } from '@/domain/events';
import { DELETE_INFO, removeTemplates, RESET, RESET_INFO, RESET_QUESTION, sourceLabel, TEMPLATES_HINT } from '@/features/message-templates';
import { formatDay, KIND_LABELS } from '@/shared/lib/format';
import { CANCEL, DELETE, SAVE_FAILED } from '@/shared/lib/strings';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import Button from '@/shared/ui/Button';
import { TrashIcon } from '@/shared/ui/icons';
import Loading from '@/shared/ui/Loading';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';

const titleOf = (t: MessageTemplate) => `${t.action === 'hide' ? 'Не операция' : KIND_LABELS[t.kind ?? ''] ?? 'Операция'} · ${sourceLabel(t.source, bankById(t.bank)?.name)}`;
const usedOf = (t: MessageTemplate) => `${t.action === 'hide' ? 'Скрыто' : 'Разобрано'}: ${t.matched}${t.last_matched_at ? ` · последнее — ${formatDay(t.last_matched_at).toLowerCase()}` : ''}`;

/** Настройки → «Шаблоны сообщений»: the user's templates with the message each was made from; removed one by one or all. */
export default function MessageTemplatesScreen() {
  const [list, setList] = useState<MessageTemplate[] | null>(null);
  const { failed, started, fail } = useLoadFailed('load templates');
  const load = useCallback(() => { started(); listTemplates().then(setList).catch(fail); }, [started, fail]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const remove = (t: MessageTemplate) => sheetAlert(`Удалить шаблон «${titleOf(t)}»?`, DELETE_INFO, [
    { text: CANCEL, style: 'cancel' },
    { text: DELETE, style: 'destructive', onPress: () => { removeTemplates(t.id).then(() => toast('Шаблон удалён')).catch(toastFailure('remove template', SAVE_FAILED)); } },
  ]);
  const reset = () => sheetAlert(RESET_QUESTION, RESET_INFO, [
    { text: CANCEL, style: 'cancel' },
    { text: RESET, style: 'destructive', onPress: () => { removeTemplates(null).then(() => toast('Шаблоны сброшены')).catch(toastFailure('reset templates', SAVE_FAILED)); } },
  ]);

  if (!list) return <Loading failed={failed} onRetry={load} />;
  return (
    <View style={styles.screen}>
    <FlatList
      style={styles.list}
      data={list}
      keyExtractor={(t) => String(t.id)}
      ListHeaderComponent={<Text style={styles.hint}>{TEMPLATES_HINT}</Text>}
      ListEmptyComponent={<Text style={styles.empty}>Шаблонов пока нет: они появляются из «Не распознано» в «Операциях».</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.title}>{titleOf(item)}</Text>
            <Text style={styles.example} numberOfLines={2}>{item.example}</Text>
            <Text style={styles.used}>{usedOf(item)}</Text>
          </View>
          <TouchableOpacity onPress={() => remove(item)} style={styles.trash} accessibilityLabel={`Удалить шаблон: ${titleOf(item)}`}>
            <TrashIcon color={colors.danger} size={20} />
          </TouchableOpacity>
        </View>
      )}
    />
    {/* pinned to the bottom, under the list */}
    {list.length ? (
      <View style={styles.footer}>
        <Text style={styles.note}>{DELETE_INFO}</Text>
        <Button title={RESET} onPress={reset} outline danger />
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted, padding: 16, paddingBottom: 12 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', padding: 32 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  flex: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  example: { fontSize: 14, color: '#374151', lineHeight: 20 },
  used: { fontSize: 13, color: colors.muted },
  trash: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  note: { fontSize: 13, lineHeight: 18, color: colors.muted },
});
