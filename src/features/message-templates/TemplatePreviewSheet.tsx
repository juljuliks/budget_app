import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Kind, ParsedTx } from '@/domain/types';
import type { UnparsedMessage } from '@/db/messages';
import { previewTemplate, saveTemplate } from '@/ingest/byTemplate';
import type { Role } from '@/parsers/template';
import { KIND_LABELS, plural } from '@/shared/lib/format';
import { LOAD_FAILED, SAVE_FAILED } from '@/shared/lib/strings';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { toast, toastFailure } from '@/shared/ui/toast';
import ResultRow from './ui/ResultRow';

type Props = {
  message: UnparsedMessage;
  marks: Record<number, Role>;
  kind: Kind;
  visible: boolean;
  onClose: () => void;
  /** saved: the messages it took are operations now */
  onSaved: () => void;
};

/** "Дальше: к каким подойдёт": the kept messages the template would read, as the operations they'd be; then saved. */
export default function TemplatePreviewSheet({ message, marks, kind, visible, onClose, onSaved }: Props) {
  const [found, setFound] = useState<Array<{ message: UnparsedMessage; parsed: ParsedTx | null }> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setFound(null);
    previewTemplate(message, marks, kind).then(setFound).catch(toastFailure('template preview', LOAD_FAILED));
  }, [visible, message, marks, kind]);

  const n = found?.length ?? 0;
  async function save() {
    setSaving(true);
    try {
      const taken = await saveTemplate(message, marks, kind);
      toast(`Шаблон сохранён, разобрано: ${taken}`);
      onSaved();
    } catch (e) {
      toastFailure('save template', SAVE_FAILED)(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Шаблон: ${(KIND_LABELS[kind] ?? '').toLowerCase()}`} style={styles.sheet}>
      <Text style={styles.count}>Подойдёт к {n} {plural(n, ['сообщению', 'сообщениям', 'сообщениям'])}</Text>
      <Text style={styles.hint}>Так они станут операциями. Если что-то не так — вернитесь и отметьте иначе.</Text>
      <SheetScrollView>
        {found?.map((f) => (f.parsed ? <ResultRow key={f.message.id} parsed={f.parsed} receivedAt={f.message.received_at} /> : null))}
      </SheetScrollView>
      <SheetActions submit={{ title: `Сохранить и разобрать ${n}`, onPress: save, disabled: saving || !found }} onCancel={onClose} style={styles.actions} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  count: { fontSize: 16, fontWeight: '600', color: colors.text, paddingHorizontal: 20 },
  hint: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, marginTop: 4, marginBottom: 10 },
  actions: { paddingHorizontal: 20 },
});
