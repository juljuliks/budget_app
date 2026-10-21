// "Разделить по категориям" being edited: the operation's own category takes what the other parts leave.
import type { TxPart } from '@/db/parts';
import { formatMoneyWithCurrency, parseAmountInput, toInputValue } from '@/shared/lib/money';

export type DraftPart = { category_id: number; text: string };
/** `own`: the operation's category (what's left), null until picked; `parts`: the other categories, as typed */
export type SplitDraft = { own: number | null; parts: DraftPart[] };

export function splitDraftOf(own: number | null, parts: TxPart[]): SplitDraft {
  return { own, parts: parts.map((p) => ({ category_id: p.category_id, text: toInputValue(p.amount_minor) })) };
}

export type SplitState = {
  /** what's left for the own category (below 0: the parts are over the amount) */
  rest: number;
  /** each part's amount (null: not typed yet or not a number) */
  amounts: Array<number | null>;
  /** what stops saving, said under the parts; null: nothing */
  error: string | null;
  canSave: boolean;
};

export function splitState(total: number, currency: string, d: SplitDraft): SplitState {
  const amounts = d.parts.map((p) => {
    const v = parseAmountInput(p.text);
    return v !== null && v > 0 ? v : null;
  });
  const rest = total - amounts.reduce<number>((a, v) => a + (v ?? 0), 0);
  const error = rest < 0 ? `Части больше суммы операции на ${formatMoneyWithCurrency(-rest, currency)}`
    : rest === 0 ? 'Первой категории ничего не остаётся' : null;
  const complete = d.own !== null && d.parts.length > 0 && amounts.every((v) => v !== null);
  return { rest, amounts, error, canSave: complete && error === null };
}

/** What to save: the parts with their amounts (call when canSave). */
export function draftParts(d: SplitDraft, s: SplitState): TxPart[] {
  return d.parts.map((p, i) => ({ category_id: p.category_id, amount_minor: s.amounts[i] ?? 0 }));
}

/** A category picked for the own row: a part in it merges into it (its amount goes to what's left). */
export function withOwn(d: SplitDraft, id: number): SplitDraft {
  return { own: id, parts: d.parts.filter((p) => p.category_id !== id) };
}

/** A part's category replaced; picking one the split already has is ignored. */
export function withPartCategory(d: SplitDraft, index: number, id: number): SplitDraft {
  if (id === d.own || d.parts.some((p) => p.category_id === id)) return d;
  return { ...d, parts: d.parts.map((p, i) => (i === index ? { ...p, category_id: id } : p)) };
}

/**
 * Categories chosen together (a long press, or "Ещё категория" with the current ones checked). The operation's own
 * stays first when it is among them; an amount already typed for a category that remains is kept.
 */
export function draftFromIds(currentId: number | null, ids: number[], prev?: SplitDraft): SplitDraft {
  const own = currentId !== null && ids.includes(currentId) ? currentId
    : prev?.own != null && ids.includes(prev.own) ? prev.own
    : ids[0] ?? null;
  const texts = new Map((prev?.parts ?? []).map((p) => [p.category_id, p.text]));
  return { own, parts: ids.filter((id) => id !== own).map((id) => ({ category_id: id, text: texts.get(id) ?? '' })) };
}

/** "Ещё категория": a new part, its amount to type. */
export function withNewPart(d: SplitDraft, id: number): SplitDraft {
  if (id === d.own || d.parts.some((p) => p.category_id === id)) return d;
  return { ...d, parts: [...d.parts, { category_id: id, text: '' }] };
}
