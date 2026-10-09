import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { saveTransactionNote } from '@/entities/transaction';
import SectionHeading from '@/shared/ui/SectionHeading';
import TextInputModal from '@/shared/ui/TextInputModal';
import { PencilIcon } from '@/shared/ui/icons';
import { toast } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';

/** The operation's note: shown with a pencil, or "＋ Добавить заметку"; edited in a sheet (empty removes it). */
export default function NoteSection({ txId, note, onSaved }: { txId: number; note: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);

  async function save(text: string): Promise<string | null> {
    await saveTransactionNote(txId, text);
    toast(text ? 'Заметка сохранена' : 'Заметка удалена');
    onSaved();
    return null;
  }

  return (
    <>
      <SectionHeading title="Заметка" />
      {note ? (
        <TouchableOpacity style={styles.note} onPress={() => setOpen(true)} accessibilityLabel="Изменить заметку">
          <Text style={styles.noteText}>{note}</Text>
          <PencilIcon color={colors.muted} size={16} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setOpen(true)} hitSlop={8}>
          <Text style={styles.link}>＋ Добавить заметку</Text>
        </TouchableOpacity>
      )}
      <TextInputModal
        visible={open}
        title="Заметка"
        initialValue={note ?? ''}
        placeholder="Например, подарок маме"
        multiline
        maxLength={500}
        allowEmpty
        onSubmit={save}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, color: colors.accent },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.surface, padding: 12, borderRadius: 8,
  },
  noteText: { flex: 1, fontSize: 15, color: colors.text },
});
