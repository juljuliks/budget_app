import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, KeyboardTypeOptions, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formStyles } from './formStyles';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** muted lines under the title (e.g. "Свободно 1 600 GEL") */
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** empty input is submitted (as '') instead of "Введите название" */
  allowEmpty?: boolean;
  /** several lines (notes) */
  multiline?: boolean;
  /** extra controls under the field (e.g. the plan item kind) */
  children?: React.ReactNode;
  /** returns an error message to show, or null when saved */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
};

/** Small dialog with one text field (create / rename, plan amounts). */
export default function TextInputModal({
  visible, title, initialValue = '', placeholder, submitLabel = 'Сохранить', hint, keyboardType, maxLength = 30, allowEmpty, multiline,
  onSubmit, onClose, children,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setValue(initialValue); setError(null); setSaving(false); }
  }, [visible, initialValue]);

  async function submit() {
    if (!value.trim() && !allowEmpty) { setError('Введите название'); return; }
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
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <TextInput
            style={[formStyles.input, multiline && styles.multiline]}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : undefined}
            value={value}
            onChangeText={(v) => { setValue(v); setError(null); }}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            autoFocus
            keyboardType={keyboardType}
            maxLength={maxLength}
            returnKeyType={multiline ? 'default' : 'done'}
            onSubmitEditing={multiline ? undefined : submit}
          />
          {children ? <View style={styles.extra}>{children}</View> : null}
          {error ? <Text style={formStyles.error}>{error}</Text> : null}
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
  hint: { fontSize: 14, color: colors.muted, marginTop: -6, marginBottom: 12 },
  extra: { marginTop: 12 },
  multiline: { minHeight: 96, maxHeight: 200 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: { paddingHorizontal: 12, paddingVertical: 8 },
  cancel: { fontSize: 16, color: colors.muted },
  submit: { fontSize: 16, fontWeight: '600', color: colors.accent },
  disabled: { opacity: 0.5 },
});
