import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { saveTransactionNote } from '@/entities/transaction';
import SectionHeading from '@/shared/ui/SectionHeading';
import TextInputModal from '@/shared/ui/TextInputModal';
import { PencilIcon } from '@/shared/ui/icons';
import { toast } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';
import { font, radius, space } from '@/shared/theme/tokens';

/** The operation's note ("Описание"; a manual operation's is the one entered with it): shown with a pencil, or
 * "＋ Добавить описание"; edited in a sheet (empty removes it). */
export default function NoteSection({
  txId,
  note,
  onSaved,
}: {
  txId: number;
  note: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function save(text: string): Promise<string | null> {
    await saveTransactionNote(txId, text);
    toast(text ? 'Описание сохранено' : 'Описание удалено');
    onSaved();
    return null;
  }

  return (
    <>
      <SectionHeading title="Описание" />
      {note ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.note}
          onPress={() => setOpen(true)}
          accessibilityLabel="Изменить описание"
        >
          <Text style={styles.noteText}>{note}</Text>
          <PencilIcon color={colors.muted} size={16} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={8}>
          <Text style={styles.link}>＋ Добавить описание</Text>
        </TouchableOpacity>
      )}
      <TextInputModal
        visible={open}
        title="Описание"
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
  link: { fontSize: font.secondary, color: colors.accent },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[8],
    backgroundColor: colors.surface,
    padding: space[12],
    borderRadius: radius.sm,
  },
  noteText: { flex: 1, fontSize: font.body, color: colors.text },
});
