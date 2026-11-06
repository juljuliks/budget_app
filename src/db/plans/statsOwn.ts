// Parts of the month stats in a plan's own currency: a category planned in $ is shown in $ (its spending on each day's
// rate), a fund — in its currency, whatever currency the stats are in.
import { NEUTRAL_COLOR } from '../../domain/colors';
import { Currency } from '../fx';
import { savingSpend } from '../recurring/saving';
import { activeFunds, fundLedger } from './funds';
import { planRateDate } from './months';
import { categoryKey, convertSpending, SpendRow, sumBy } from './spend';
import type { FundStat } from './stats';

type SpentBy = Map<number | null | 'refund', number>;

/** The month's spending by category in each of `currencies` (the payments saved up for: their contributions). */
export async function spentIn(ym: string, rows: SpendRow[], currencies: Currency[]): Promise<Map<Currency, SpentBy>> {
  const out = new Map<Currency, SpentBy>();
  const planDate = planRateDate(ym);
  for (const cur of new Set(currencies)) {
    const { items, conv } = await convertSpending(rows, cur, [planDate]);
    const by: SpentBy = sumBy(items, categoryKey);
    for (const [id, minor] of await savingSpend(ym, (m, from) => conv(m, from, cur, planDate) ?? 0)) by.set(id, (by.get(id) ?? 0) + minor);
    out.set(cur, by);
  }
  return out;
}

/** The month's funds as stats: each one's month of its ledger, converted to `shown`; in another currency — its own too. */
export async function monthFunds(
  ym: string, shown: Currency, toShown: (minor: number, from: string) => number,
  cats: Array<{ id: number; name: string; emoji: string | null }>, colorOf: Map<number, string>,
): Promise<FundStat[]> {
  const out: FundStat[] = [];
  for (const fund of await activeFunds(ym)) {
    const c = cats.find((r) => r.id === fund.category_id);
    const m = (await fundLedger(fund, ym)).months.find((x) => x.ym === ym);
    if (!c || !m) continue;
    const v = (minor: number) => toShown(minor, fund.currency);
    out.push({
      category_id: c.id, name: c.name, emoji: c.emoji, color: colorOf.get(c.id) ?? NEUTRAL_COLOR, spent_minor: v(m.spent),
      available_minor: v(m.start + m.contribution), shortage_minor: v(m.shortage), left_minor: v(m.end), contribution_minor: v(m.contribution),
      target_minor: v(fund.target_minor), due: fund.due,
      own: fund.currency === shown ? null : { currency: fund.currency, spent_minor: m.spent, shortage_minor: m.shortage },
    });
  }
  return out;
}
