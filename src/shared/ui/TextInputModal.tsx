import React from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, FieldValues, Path, PathValue, useFormState, UseFormReturn } from 'react-hook-form';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import { submitForm, useLoadedForm } from './form';
import { toastError } from './toast';
import { formStyles } from '../theme/formStyles';
import { colors } from '../theme/theme';

/** The field this sheet edits; a form passed in may hold more (the amount's currency, the plan item kind, …). */
export type TextFormValues = { value: string };

type Props<V extends TextFormValues & FieldValues> = {
  visible: boolean;
  title: string;
  /** the title a link with an arrow (see BottomSheet) */
  onTitlePress?: () => void;
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
  /** between the hint and the field (the plan's kinds: what the amount is depends on them) */
  above?: React.ReactNode;
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
  /** a caption over the field ("Накопить") */
  label?: string;
  /** the submit button greyed even with changes: something it needs is not filled in yet */
  submitDisabled?: boolean;
  /** returns an error message to show, null when saved, false to stay open without one (a question asked over it) */
  onSubmit: (value: string) => Promise<string | null | false>;
  onClose: () => void;
};

/**
 * A bottom sheet with one text field (create / rename, amounts, notes). Its submit button shows only once
 * something in the form changed.
 */
export default function TextInputModal<V extends TextFormValues & FieldValues = TextFormValues>({
  visible, title, onTitlePress, initialValue = '', form: outer, placeholder, submitLabel = 'Сохранить', hint, keyboardType, maxLength = 30,
  allowEmpty, multiline, onSubmit, onClose, children, inputAccessory, headerRight, remove, label, submitDisabled, above,
}: Props<V>) {
  // used only without a form of the caller's (a hook can't be skipped)
  const own = useLoadedForm<TextFormValues>(outer ? null : { value: initialValue }, visible);
  const form = (outer ?? own) as unknown as UseFormReturn<TextFormValues>;
  const { isDirty, isSubmitting } = useFormState({ control: form.control });

  const submit = submitForm(form, async ({ value }) => {
    try {
      const err = await onSubmit(value.trim());
      if (err) toastError(err); else if (err === null) onClose();
    } catch (e) {
      console.error('save failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} onTitlePress={onTitlePress} headerRight={headerRight}>
        {/* a tall form (the plan's amount) scrolls; its buttons stay under it */}
        <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialog} style={styles.scroll}>
          {typeof hint === 'string' ? <Text style={styles.hint}>{hint}</Text> : hint ?? null}
          {above ? <View style={styles.above}>{above}</View> : null}
          {label ? <Text style={[formStyles.label, styles.label]}>{label}</Text> : null}
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
                onSubmitEditing={multiline || !isDirty || submitDisabled ? undefined : submit}
              />
            )}
          />
          {inputAccessory}
          </View>
          {children ? <View style={styles.extra}>{children}</View> : null}
        </SheetScrollView>
        <View style={styles.dialog}>
          {/* the submit button greyed until something changed: nothing to save otherwise */}
          <SheetActions
            submit={{ title: submitLabel, onPress: submit, disabled: isSubmitting || !isDirty || !!submitDisabled }}
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
  scroll: { flexShrink: 1 },
  hint: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  label: { marginTop: 0 },
  extra: { marginTop: 12 },
  above: { marginBottom: 12 },
  // the field and its accessory (the currency) the same height
  inputRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  input: { flex: 1 },
  multiline: { minHeight: 96, maxHeight: 200 },
});
