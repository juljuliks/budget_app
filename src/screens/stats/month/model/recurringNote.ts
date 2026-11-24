// Under a category with repeating payments in the month's stats: what they are — its only payment's period and day
// ("каждый месяц · следующее 3 ноя"), its payments by name, "вручную · задайте даты …"; all of them in another currency —
// "(12 $)" first. No React.
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { chargeAt, ONCE, todayKey } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { periodText } from '@/shared/lib/format';

/**
 * The texts it is made of, from the slices (entities/category paymentWords, features/recurring-payments shortDay,
 * inTime): passed in, this file stays free of their React.
 */
export type NoteTexts = {
  words: (byMerchant: boolean) => { none: string; toAll: string; noDated: string };
  shortDay: (day: string) => string;
  inTime: (day: string, today: string) => string | null;
};

export function recurringNote(item: PlanItem, currency: Currency, current: boolean, t: NoteTexts): string {
  const { shortDay, inTime } = t;
  const names = item.subs?.names ?? [];
  const saving = item.subs?.saving_names ?? [];
  const listed = [names.join(', '), saving.length ? `копим: ${saving.join(', ')}` : ''].filter(Boolean).join(' · ');
  const w = t.words(!!item.by_merchant);
  const one = item.subs?.single;
  // its only payment: how often and when (a charge done — the next one); a subscription without a day — "без даты";
  // "через N дней" — from today, in the current month only
  const next = one?.day && one.done ? (one.period === ONCE ? null : chargeAt(one.day, one.period, 1)) : null;
  const single = one
    ? [
        periodText(one.period),
        next
          ? `следующее ${shortDay(next)}`
          : one.day && one.done
            ? shortDay(one.day)
            : one.day
              ? [shortDay(one.day), current ? inTime(one.day, todayKey()) : null].filter(Boolean).join(', ')
              : item.by_merchant
                ? 'без даты'
                : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const note =
    single ??
    (item.subs?.empty ? w.none : item.kind !== 'subs' ? `вручную · задайте даты ${w.toAll}` : listed || w.noDated);
  const own = item.kind === 'subs' ? item.subs?.in_currency : undefined;
  const foreign =
    own && own.currency !== currency && own.charges_minor > 0
      ? `(${formatWithCurrency(own.charges_minor, own.currency)}) · `
      : '';
  return `${foreign}${note}`;
}

/** Each category with repeating payments in the plan: its note, by its id. */
export function recurringNotes(
  items: PlanItem[],
  currency: Currency,
  current: boolean,
  t: NoteTexts,
): Map<number, string> {
  return new Map(items.filter((i) => i.recurring).map((i) => [i.category_id, recurringNote(i, currency, current, t)]));
}
