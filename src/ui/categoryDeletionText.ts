import { categoryLabel } from '../db/categories';
import type { Bucket, DeletePreview, SortOutSummary } from '../db/categoryDeletion';
import { plural } from './format';
import { formatMoneyWithCurrency } from './money';

// The texts of deleting a category (CategoryDeleteSheet, the sort-out in the operations list): kept here, tested.

export type SheetText = { title: string; message: string };

const ops = (n: number) => `${n} ${plural(n, ['операция', 'операции', 'операций'])}`;
/** "840 ₾" / "840 ₾ + 20 $" */
export const money = (b: Bucket) => b.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
/** "12 операций на 840 ₾" */
export const opsOn = (b: Bucket) => (b.totals.length ? `${ops(b.n)} на ${money(b)}` : ops(b.n));
/** "Zara, H&M и ещё 3" */
export function names(list: string[]): string {
  return list.length > 3 ? `${list.slice(0, 2).join(', ')} и ещё ${list.length - 2}` : list.join(', ');
}
const merchantsN = (n: number) => `${n} ${plural(n, ['мерчант', 'мерчанта', 'мерчантов'])}`;

// past months and the plan: what deleting says about them, whichever way
const past = (label: string, p: DeletePreview) =>
  `${opsOn(p.past)} прошлых месяцев ${p.past.n === 1 ? 'останется' : 'останутся'} в «${label}» — история и отчёты не изменятся.`;
const plan = (label: string) => `План «${label}» на этот месяц удалится.`;

/** No operations this month: a plain confirmation. */
export function deleteEmptyText(label: string, p: DeletePreview): SheetText {
  const lines = ['В этом месяце операций в ней нет.'];
  if (p.past.n > 0) lines.push(past(label, p));
  if (p.merchants.length > 0) {
    lines.push(`${p.merchants.length === 1 ? `Мерчант ${names(p.merchants)} останется` : `${merchantsN(p.merchants.length)} (${names(p.merchants)}) останутся`} без категории.`);
  }
  if (p.hasPlan) lines.push(plan(label));
  return { title: `Удалить категорию «${label}»?`, message: lines.join(' ') };
}

/** The sheet's text with operations this month: they have to go somewhere first. */
export function deleteStartText(p: DeletePreview, label: string): string {
  return `В этом месяце в «${label}» ${opsOn(p.current)}. Перед удалением их нужно перенести — в одну категорию или разложить по нескольким.`;
}

/** All of this month's to one category (`target` null = none): the confirmation. */
export function moveAllText(label: string, target: string | null, p: DeletePreview): SheetText {
  const lines = [target
    ? `• ${opsOn(p.current)} этого месяца ${p.current.n === 1 ? 'перейдёт' : 'перейдут'} в «${target}».`
    : `• ${opsOn(p.current)} этого месяца ${p.current.n === 1 ? 'останется' : 'останутся'} без категории.`];
  if (p.past.n > 0) lines.push(`• ${past(label, p)}`);
  if (p.merchants.length > 0) {
    const who = p.merchants.length === 1 ? `Мерчант ${names(p.merchants)}` : `${merchantsN(p.merchants.length)} (${names(p.merchants)})`;
    const one = p.merchants.length === 1;
    lines.push(target
      ? `• ${who} ${one ? 'получит' : 'получат'} категорию «${target}» — ${one ? 'его' : 'их'} новые операции будут попадать туда.`
      : `• ${who} ${one ? 'останется' : 'останутся'} без категории — ${one ? 'его' : 'их'} новые операции придётся размечать вручную.`);
  }
  if (p.hasPlan) lines.push(`• ${plan(label)}`);
  return { title: target ? `Перенести в «${target}» и удалить «${label}»?` : `Удалить «${label}»?`, message: lines.join('\n') };
}

/** The banner over the operations while sorting out. */
export function sortOutBanner(label: string, remaining: Bucket): string {
  return `Удаление «${label}»: ${remaining.n === 1 ? 'осталась' : 'осталось'} ${opsOn(remaining)}`;
}

/** Sorting out, several operations of merchants of another category to one: the question. */
export function sortOutMerchantText(target: string, label: string, merchants: string[], selected: number): SheetText & { only: string; also: string } {
  const one = merchants.length === 1;
  return {
    title: `Категория «${target}» — только для выбранных операций или и для ${one ? 'мерчанта' : 'мерчантов'}?`,
    message: `${one ? `Мерчант ${names(merchants)} получит` : `Мерчанты (${names(merchants)}) получат`} категорию «${target}» — ${one ? 'его' : 'их'} новые операции будут попадать туда. Прошлые месяцы останутся в «${label}».`,
    only: `Только для выбранных (${selected})`,
    also: one ? 'И для мерчанта' : 'И для мерчантов',
  };
}

/** Nothing left: where they went, what deleting does next. `p`: the preview now (past, merchants still on it, plan). */
export function sortOutDoneText(label: string, s: SortOutSummary, p: DeletePreview): SheetText {
  const name = (m: SortOutSummary['moved'][number]) => categoryLabel({ emoji: m.emoji, name: m.name ?? '?', type_name: m.type_name });
  const where = (m: SortOutSummary['moved'][number]) => (m.category_id === null ? 'без категории' : `в «${name(m)}»`);
  const total: Bucket = { n: s.moved.reduce((a, m) => a + m.n, 0), totals: [] };
  const sums = new Map<string, number>();
  for (const m of s.moved) for (const t of m.totals) sums.set(t.currency, (sums.get(t.currency) ?? 0) + t.amount_minor);
  total.totals = [...sums].map(([currency, amount_minor]) => ({ currency, amount_minor })).sort((a, b) => b.amount_minor - a.amount_minor);

  const lines: string[] = [];
  if (s.moved.length === 1) {
    const m = s.moved[0];
    lines.push(m.category_id === null
      ? `${opsOn(total)} ${total.n === 1 ? 'осталась' : 'остались'} без категории.`
      : `${opsOn(total)} ${total.n === 1 ? 'перенесена' : 'перенесены'} в «${name(m)}».`);
  } else if (s.moved.length > 1) {
    lines.push(`${opsOn(total)}:`);
    for (const m of s.moved) lines.push(`• ${where(m)} — ${m.n}${m.totals.length ? ` на ${money(m)}` : ''}`);
  }
  if (s.deleted.n > 0) lines.push(`Удалено: ${ops(s.deleted.n)}.`);
  const after: string[] = [];
  if (p.past.n > 0) after.push(past(label, p));
  if (p.merchants.length > 0) {
    const one = p.merchants.length === 1;
    after.push(`${one ? `Мерчант ${names(p.merchants)} всё ещё` : `${merchantsN(p.merchants.length)} (${names(p.merchants)}) всё ещё`} с категорией «${label}» — после удаления ${one ? 'останется' : 'останутся'} без категории.`);
  }
  if (p.hasPlan) after.push(plan(label));
  return { title: 'Все операции перенесены', message: [lines.join('\n'), after.join(' ')].filter(Boolean).join('\n\n') };
}

/** Leaving the sort-out before it's done. */
export function sortOutLeaveText(label: string): SheetText {
  return {
    title: `Прервать удаление «${label}»?`,
    message: `Категория «${label}» не удалится. Уже перенесённые операции останутся там, куда вы их перенесли.`,
  };
}

