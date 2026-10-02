import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** returns an error message to show, or null when saved */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
};

/** Small dialog with one text field (create / rename). */
export default function NameInputModal({
  visible, title, initialValue = '', placeholder, submitLabel = 'Сохранить', onSubmit, onClose,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setValue(initialValue); setError(null); setSaving(false); }
  }, [visible, initialValue]);

  async function submit() {
    if (!value.trim()) { setError('Введите название'); return; }
    setSaving(true);
    const err = await onSubmit(value.trim());
    setSaving(false);
    if (err) setError(err); else onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(v) => { setValue(v); setError(null); }}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            autoFocus
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.cancel}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={submit} disabled={saving}>
              <Text style={[styles.submit, saving && styles.disabled]}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.bg, borderRadius: 12, padding: 20 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  error: { color: colors.danger, marginTop: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: { paddingHorizontal: 12, paddingVertical: 8 },
  cancel: { fontSize: 16, color: colors.muted },
  submit: { fontSize: 16, fontWeight: '600', color: colors.accent },
  disabled: { opacity: 0.5 },
});
