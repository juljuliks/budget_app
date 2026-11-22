// A fund that stopped making it by its date: the notice's lines and who is new among the late ones. No notifee.
import { fundForecasts, FundForecast } from '../db/plans';
import { getSetting, setSetting } from '../db/settings';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';

const KEY = 'funds_late';

/** The notice of a fund not making it; `hide` — no amounts. */
export function fundLateNotice(label: string, f: FundForecast, hide: boolean): { title: string; body: string } {
  const got = formatWithCurrency(f.fromFree + f.fromLocked, f.currency);
  return {
    title: `${label} не успевает к ${dayTitle(f.due)}`,
    body: hide || f.status === 'full'
      ? 'Бюджет расписан: сдвиньте дату или сумму копилки'
      : `Копилке остаётся ${got} в месяц из ${formatWithCurrency(f.asked, f.currency)} — сдвиньте дату или сумму`,
  };
}

/** The funds not making it now that did before: their ids (and remembers who doesn't now). */
export async function newlyLate(): Promise<Map<number, FundForecast>> {
  const forecasts = await fundForecasts();
  const late = [...forecasts.values()].filter((f) => f.status !== 'ok');
  const was = new Set<number>(JSON.parse((await getSetting(KEY)) ?? '[]') as number[]);
  await setSetting(KEY, JSON.stringify(late.map((f) => f.category_id)));
  return new Map(late.filter((f) => !was.has(f.category_id)).map((f) => [f.category_id, f]));
}

