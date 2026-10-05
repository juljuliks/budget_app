import { useEffect, useRef } from 'react';
import { DefaultValues, FieldValues, SubmitHandler, useForm, UseFormReturn } from 'react-hook-form';
import { toastError } from './toast';

// Forms: every form keeps its values in react-hook-form (not useState), validates through its rules and knows
// whether anything changed (formState.isDirty) — "Сохранить" shows only then.

/**
 * A form in a sheet or on a screen that loads what it edits: `defaults` are the saved values (null while they
 * load). The form resets to them when the sheet opens and whenever they change, so isDirty means "differs from
 * what is saved". A suggestion that should be savable as is (last month's amount for a new plan item) is set
 * after the reset with setValue(…, { shouldDirty: true }).
 */
export function useLoadedForm<V extends FieldValues>(defaults: V | null, open = true): UseFormReturn<V> {
  const form = useForm<V>({ defaultValues: (defaults ?? undefined) as DefaultValues<V> | undefined });
  // the defaults by content: a caller may build the object on every render
  const key = defaults === null ? null : JSON.stringify(defaults);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { last.current = null; return; }
    if (key === null || key === last.current) return;
    last.current = key;
    form.reset(JSON.parse(key) as V);
  }, [open, key, form]);
  return form;
}

/** The first error message among a form's errors (`ref` is a field's component: never walked). */
function firstMessage(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const m = (node as { message?: unknown }).message;
  if (typeof m === 'string' && m) return m;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k !== 'ref' && v && typeof v === 'object') {
      const found = firstMessage(v);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The form's submit: `onValid` with its values, or — when a rule fails — the rule's message in a red toast
 * ("Введите сумму"). Errors are never shown in the form itself; a save that fails calls toastError() too.
 */
export function submitForm<V extends FieldValues>(form: UseFormReturn<V>, onValid: SubmitHandler<V>) {
  return form.handleSubmit(onValid, (errors) => toastError(firstMessage(errors) ?? 'Проверьте форму'));
}
