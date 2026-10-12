import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { UnparsedMessage } from '@/db/messages';
import { addFromMessage, previewTemplate, saveTemplate } from '@/ingest/byTemplate';
import { CANCEL, SAVE_FAILED } from '@/shared/lib/strings';
import Button from '@/shared/ui/Button';
import SectionHeading from '@/shared/ui/SectionHeading';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';
import { useMarking } from './model/useMarking';
import TemplatePreviewSheet from './TemplatePreviewSheet';
import MarkSteps from './ui/MarkSteps';
import ResultRow from './ui/ResultRow';
import { HIDE, HIDE_QUESTION, HIDE_SUCH, hideInfo, missingText, NEXT, ONLY_THIS, STEP_RESULT } from './texts';

/**
 * A message no operation came from, marked by the user: the amount, its currency, the merchant, the date, the balance
 * and the type make a template ("Дальше"), or one operation ("Создать только эту операцию"); or it is not an operation
 * and such ones are hidden from now on (asked first). `onDone`: it has left "Не распознано".
 */
export default function MarkMessage({ message, onDone }: { message: UnparsedMessage; onDone: () => void }) {
  const m = useMarking(message);
  const [preview, setPreview] = useState(false);

  function onlyThis() {
    addFromMessage(message, m.marks, m.kind)
      .then(() => { toast('Операция добавлена'); onDone(); })
      .catch(toastFailure('add from message', SAVE_FAILED));
  }

  async function askHide() {
    const like = await previewTemplate(message, {}, null).catch(() => []);
    sheetAlert(HIDE_QUESTION, hideInfo(Math.max(0, like.length - 1)), [
      { text: CANCEL, style: 'cancel' },
      {
        text: HIDE, style: 'destructive', onPress: () => {
          saveTemplate(message, {}, null)
            .then((n) => { toast(`Скрыто сообщений: ${n}`); onDone(); })
            .catch(toastFailure('hide such', SAVE_FAILED));
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <MarkSteps words={m.words} role={m.role} onRole={m.setRole} marks={m.marks} onWord={m.toggle} kind={m.kind} onKind={m.setKind} />
        <SectionHeading title={STEP_RESULT} />
        {/* the result as a row of the operations list, edge to edge */}
        <View style={styles.edge}>
          {m.result ? <ResultRow parsed={m.result} receivedAt={message.received_at} /> : null}
        </View>
        {m.missing.length ? <Text style={styles.missing}>{missingText(m.missing)}</Text> : null}
      </ScrollView>
      <View style={styles.actions}>
        <Button title={NEXT} onPress={() => setPreview(true)} disabled={!m.result} />
        <Button title={ONLY_THIS} onPress={onlyThis} disabled={!m.result} outline />
        <Button title={HIDE_SUCH} onPress={() => { askHide().catch(() => undefined); }} outline danger />
      </View>
      <TemplatePreviewSheet
        message={message}
        marks={m.marks}
        kind={m.kind}
        visible={preview}
        onClose={() => setPreview(false)}
        onSaved={() => { setPreview(false); onDone(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 8 },
  edge: { marginHorizontal: -16 },
  missing: { fontSize: 13, color: colors.warn, paddingTop: 8 },
  actions: { padding: 16, gap: 10 },
});
