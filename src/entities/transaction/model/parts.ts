// A split operation's parts as the list and its card show them (the parts themselves: db/parts.ts).
import { categoryLabel, txCategoryLabel } from '@/db/categories';
import type { TransactionRow } from '@/db/transactions';

export type PartView = { category_id: number; amount_minor: number; label: string };

type Split = Pick<TransactionRow, 'amount_minor' | 'category_id' | 'category_name' | 'category_emoji' | 'category_type_name' | 'parts'>;

/** The parts in other categories from the row's `parts` column (PARTS_COLUMN), the biggest first. */
export function parseParts(raw: string | null): PartView[] {
  if (!raw) return [];
  return raw.split('\u001e').map((p) => {
    const [id, amount, emoji, type, name] = p.split('\u001f');
    return { category_id: Number(id), amount_minor: Number(amount), label: categoryLabel({ emoji, name, type_name: type || null }) };
  });
}

/** Every part of a split operation, its own category first (what the others leave); null: not split. */
export function splitParts(tx: Split): PartView[] | null {
  const others = parseParts(tx.parts);
  if (others.length === 0 || tx.category_id === null) return null;
  const rest = tx.amount_minor - others.reduce((a, p) => a + p.amount_minor, 0);
  return [{ category_id: tx.category_id, amount_minor: rest, label: txCategoryLabel(tx) ?? '' }, ...others];
}

/** "🛒 Жизнь: Продукты + 🏠 Дом и коммуналка", three and more — "🛒 Жизнь: Продукты + ещё 2". */
export function partsLabel(parts: PartView[]): string {
  if (parts.length <= 1) return parts[0]?.label ?? '';
  return `${parts[0].label} + ${parts.length === 2 ? parts[1].label : `ещё ${parts.length - 1}`}`;
}

/**
 * A split operation's row: its categories, and the amount — in a list filtered by categories (`focus`), only its parts
 * in them (`part`: not the whole, named after it), those first. null: not split.
 */
export function splitRow(tx: Split & { focus?: number[] }): { label: string; amount_minor: number; part: boolean } | null {
  const parts = splitParts(tx);
  if (!parts) return null;
  const shown = tx.focus ? parts.filter((p) => tx.focus!.includes(p.category_id)) : [];
  if (shown.length === 0 || shown.length === parts.length) return { label: partsLabel(parts), amount_minor: tx.amount_minor, part: false };
  return {
    label: partsLabel([...shown, ...parts.filter((p) => !shown.includes(p))]),
    amount_minor: shown.reduce((a, p) => a + p.amount_minor, 0),
    part: true,
  };
}
