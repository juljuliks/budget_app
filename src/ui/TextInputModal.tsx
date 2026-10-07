import React from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, FieldValues, Path, PathValue, useFormState, UseFormReturn } from 'react-hook-form';
import BottomSheet from './BottomSheet';
import { SheetActions } from './Button';
import { submitForm, useLoadedForm } from './form';
import { toastError } from './toast';
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
  hint?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** empty input is submitted (as '') instead of "Введите название" */
  allowEmpty?: boolean;
  /** several lines (notes) */
  multiline?: boolean;
  /** extra controls under the field (e.g. the plan item kind) */
  children?: React.ReactNode;
  /** a control right of the title (e.g. delete) */
  headerRight?: React.ReactNode;
  /** a destructive action under the submit button ("Удалить из плана"); then no "Отмена" (three buttons) */
  remove?: { title: string; onPress: () => void };
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
  allowEmpty, multiline, onSubmit, onClose, children, inputAccessory, headerRight, remove,
}: Props<V>) {
  // used only without a form of the caller's (a hook can't be skipped)
  const own = useLoadedForm<TextFormValues>(outer ? null : { value: initialValue }, visible);
  const form = (outer ?? own) as unknown as UseFormReturn<TextFormValues>;
  const { isDirty, isSubmitting } = useFormState({ control: form.control });

  const submit = submitForm(form, async ({ value }) => {
    try {
      const err = await onSubmit(value.trim());
      if (err) toastError(err); else onClose();
    } catch (e) {
      console.error('save failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} headerRight={headerRight}>
        <View style={styles.dialog}>
          {typeof hint === 'string' ? <Text style={styles.hint}>{hint}</Text> : hint ?? null}
          <View style={styles.inputRow}>
          <Controller
            control={form.control}
            name="value"
            rules={{ validate: (v) => allowEmpty || !!v.trim() || 'Введите название' }}
            render={({ field }) => (
              <TextInput
                style={[formStyles.input, styles.input, multiline && styles.multiline]}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : undefined}
                value={field.value}
                onChangeText={field.onChange}
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
          {/* the submit button greyed until something changed: nothing to save otherwise */}
          <SheetActions
            submit={{ title: submitLabel, onPress: submit, disabled: isSubmitting || !isDirty }}
            extra={remove ? [{ title: remove.title, danger: true, onPress: remove.onPress }] : undefined}
            onCancel={remove ? undefined : onClose}
          />
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
