import React, { useEffect, useRef, useState } from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { formStyles } from './formStyles';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** muted lines under the title (e.g. "Свободно 1 600 ₾") */
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** empty input is submitted (as '') instead of "Введите название" */
  allowEmpty?: boolean;
  /** several lines (notes) */
  multiline?: boolean;
  /** extra controls under the field (e.g. the plan item kind) */
  children?: React.ReactNode;
  /** a control right of the field (e.g. the amount's currency) */
  inputAccessory?: React.ReactNode;
  /** returns an error message to show, or null when saved */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
};

/** A bottom sheet with one text field (create / rename, amounts, notes). */
export default function TextInputModal({
  visible, title, initialValue = '', placeholder, submitLabel = 'Сохранить', hint, keyboardType, maxLength = 30, allowEmpty, multiline,
  onSubmit, onClose, children, inputAccessory,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (visible) { setValue(initialValue); setError(null); setSaving(false); }
  }, [visible, initialValue]);
  // an empty field gets the keyboard once the sheet has slid up (autoFocus during the animation doesn't show it);
  // a prefilled one doesn't: the keyboard would cover the other choices (currency, kind, norm)
  useEffect(() => {
    if (!visible || initialValue) return undefined;
    const t = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [visible, initialValue]);

  async function submit() {
    if (!value.trim() && !allowEmpty) { setError('Введите название'); return; }
    setSaving(true);
    const err = await onSubmit(value.trim());
    setSaving(false);
    if (err) setError(err); else onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
        <View style={styles.dialog}>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <View style={styles.inputRow}>
          <TextInput
            ref={input}
            style={[formStyles.input, styles.input, multiline && styles.multiline]}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : undefined}
            value={value}
            onChangeText={(v) => { setValue(v); setError(null); }}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={keyboardType}
            maxLength={maxLength}
            returnKeyType={multiline ? 'default' : 'done'}
            onSubmitEditing={multiline ? undefined : submit}
          />
          {inputAccessory}
          </View>
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  dialog: { paddingHorizontal: 20 },
  hint: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  extra: { marginTop: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1 },
  multiline: { minHeight: 96, maxHeight: 200 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: { paddingHorizontal: 12, paddingVertical: 8 },
  cancel: { fontSize: 16, color: colors.muted },
  submit: { fontSize: 16, fontWeight: '600', color: colors.accent },
  disabled: { opacity: 0.5 },
});
