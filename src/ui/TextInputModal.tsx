import React, { useEffect, useRef } from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, FieldValues, Path, PathValue, useFormState, UseFormReturn } from 'react-hook-form';
import BottomSheet from './BottomSheet';
import { SheetActions } from './Button';
import { clearFormErrors, formError, useLoadedForm } from './form';
import { formStyles } from './formStyles';
import { colors } from './theme';

/** The field this sheet edits; a form passed in may hold more (the amount's currency, the plan item kind, …). */
export type TextFormValues = { value: string };

type Props<V extends TextFormValues & FieldValues> = {
  visible: boolean;
  title: string;
  /** the saved value (ignored with `form`: its defaults hold it) */
  initialValue?: string;
  /**
   * a form of the caller's with `value` and its other fields, already reset to what is saved (useLoadedForm):
   * "Сохранить" shows once any of them changed. Without it the sheet keeps `value` in a form of its own.
   */
  form?: UseFormReturn<V>;
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

/**
 * A bottom sheet with one text field (create / rename, amounts, notes). Its submit button shows only once
 * something in the form changed.
 */
export default function TextInputModal<V extends TextFormValues & FieldValues = TextFormValues>({
  visible, title, initialValue = '', form: outer, placeholder, submitLabel = 'Сохранить', hint, keyboardType, maxLength = 30,
  allowEmpty, multiline, onSubmit, onClose, children, inputAccessory,
}: Props<V>) {
  // used only without a form of the caller's (a hook can't be skipped)
  const own = useLoadedForm<TextFormValues>(outer ? null : { value: initialValue }, visible);
  const form = (outer ?? own) as unknown as UseFormReturn<TextFormValues>;
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const error = formError(form);

  const input = useRef<TextInput>(null);
  // an empty field gets the keyboard once the sheet has slid up (autoFocus during the animation doesn't show it);
  // a prefilled one doesn't: the keyboard would cover the other choices (currency, kind, norm)
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => { if (!form.getValues('value')) input.current?.focus(); }, 300);
    return () => clearTimeout(t);
  }, [visible, form]);

  const submit = form.handleSubmit(async ({ value }) => {
    const err = await onSubmit(value.trim());
    if (err) form.setError('root.server', { message: err }); else onClose();
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
        <View style={styles.dialog}>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <View style={styles.inputRow}>
          <Controller
            control={form.control}
            name="value"
            rules={{ validate: (v) => allowEmpty || !!v.trim() || 'Введите название' }}
            render={({ field }) => (
              <TextInput
                ref={input}
                style={[formStyles.input, styles.input, multiline && styles.multiline]}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : undefined}
                value={field.value}
                onChangeText={(v) => { field.onChange(v); clearFormErrors(form); }}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                keyboardType={keyboardType}
                maxLength={maxLength}
                returnKeyType={multiline ? 'default' : 'done'}
                onSubmitEditing={multiline || !isDirty ? undefined : submit}
              />
            )}
          />
          {inputAccessory}
          </View>
          {children ? <View style={styles.extra}>{children}</View> : null}
          {error ? <Text style={formStyles.error}>{error}</Text> : null}
          {/* the submit button only once something changed: nothing to save otherwise */}
          <SheetActions submit={isDirty ? { title: submitLabel, onPress: submit, disabled: isSubmitting } : null} onCancel={onClose} />
        </View>
    </BottomSheet>
  );
}

/** Sets a field of a sheet's form from a control (currency, kind, …), marking the form changed. */
export function setField<V extends FieldValues, K extends Path<V>>(form: UseFormReturn<V>, name: K, value: PathValue<V, K>) {
  form.setValue(name, value, { shouldDirty: true });
}

const styles = StyleSheet.create({
  dialog: { paddingHorizontal: 20 },
  hint: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  extra: { marginTop: 12 },
  // the field and its accessory (the currency) the same height
  inputRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  input: { flex: 1 },
  multiline: { minHeight: 96, maxHeight: 200 },
});
