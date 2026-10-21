// Which categories the shared picker offers, and in what order. Pure: the sheet and the categories page both use it.
import { isTopUp, isTransferCategory, type Category } from '@/db/categories';
import { normalizeForSearch } from '@/db/transactions/filter';
import { NO_CATEGORY, NO_SECTION } from '@/shared/lib/strings';

/** A category name matches the search (case, ё/е, extra spaces). An empty query matches everything. */
export function matchesQuery(name: string, query: string): boolean {
  const q = normalizeForSearch(query);
  return !q || normalizeForSearch(name).includes(q);
}

/** "Без категории" is a row of the picker, and it is searched like a category. */
export function showNone(query: string, allowNone: boolean): boolean {
  return allowNone && matchesQuery(NO_CATEGORY, query);
}

/** `title` null: rows with no band (a deposit's "Пополнение счёта" pulled out of a shared section). */
export type ChooseSection = { title: string | null; data: Category[] };

function group(cats: Category[]): ChooseSection[] {
  const sections: ChooseSection[] = [];
  for (const c of cats) {
    const title = c.type_name ?? NO_SECTION;
    const last = sections[sections.length - 1];
    if (!last || last.title !== title) sections.push({ title, data: [c] });
    else last.data.push(c);
  }
  return sections;
}

function moveFirst(sections: ChooseSection[], title: string): ChooseSection[] {
  const i = sections.findIndex((s) => s.title === title);
  if (i <= 0) return sections;
  return [sections[i], ...sections.slice(0, i), ...sections.slice(i + 1)];
}

/**
 * Live categories left after the search and the exclusions. "Пополнение счёта" only for a deposit, and first there;
 * then the transfer section (also first for a transfer). A section with nothing left is absent.
 */
export function orderedSections(cats: Category[], opts: {
  query: string;
  excludeIds?: number[];
  deposit?: boolean;
  transferFirst?: boolean;
}): ChooseSection[] {
  const excluded = new Set(opts.excludeIds ?? []);
  const visible = cats.filter((c) => !excluded.has(c.id) && matchesQuery(c.name, opts.query) && (opts.deposit || !isTopUp(c)));
  const lead = opts.deposit ? visible.filter(isTopUp) : [];
  const rest = lead.length ? visible.filter((c) => !isTopUp(c)) : visible;
  const transfer = rest.find(isTransferCategory)?.type_name;
  let sections = group(rest);
  if ((opts.deposit || opts.transferFirst) && transfer) sections = moveFirst(sections, transfer);
  if (!lead.length) return sections;
  // the top-up shares its section with other categories: don't repeat the band, just lead with the row
  const title = lead[0].type_name ?? NO_SECTION;
  return [{ title: sections.some((s) => s.title === title) ? null : title, data: lead }, ...sections];
}
