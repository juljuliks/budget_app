// «Итоги года» as the stories show it: the year's lines, the bars by month, the table. No React.
import type { YearMonth, YearReport } from '@/db/yearReport';
import { currentYm } from '@/db/plans';
import { dayTitle, MONTHS, SHORT_MONTHS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';

const monthName = (ym: string) => MONTHS[Number(ym.slice(5)) - 1];
const months = (n: number) => `${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;

/**
 * A month's bar: its share of the budget against the tallest one; below the goal — paler; no data — grey, not pressed;
 * a month over with a plan — its report.
 */
export type YearBar = { ym: string; label: string; pct: number | null; height: number; down: boolean; pale: boolean; grey: boolean; pressable: boolean };

export function yearBars(r: YearReport): { bars: YearBar[]; goalAt: number | null; reached: number } {
  const pcts = r.months.map((m) => m.pct ?? 0);
  const top = Math.max(1, ...pcts.map(Math.abs), r.goalPct ?? 0);
  const bars = r.months.map((m) => ({
    ym: m.ym, label: SHORT_MONTHS[Number(m.ym.slice(5)) - 1], pct: m.pct,
    height: m.pct === null ? 0 : Math.abs(m.pct) / top, down: (m.pct ?? 0) < 0,
    pale: m.pct !== null && r.goalPct !== null && m.pct < r.goalPct,
    grey: m.state !== 'data', pressable: m.state === 'data' && m.hasPlan && m.ym < currentYm(),
  }));
  return { bars, goalAt: r.goalPct === null ? null : r.goalPct / top, reached: r.goalPct === null ? 0 : r.months.filter((m) => m.pct !== null && m.pct >= r.goalPct!).length };
}

/** A row of «Месяц за месяцем»: «—» where there is nothing (a future month; no budget — no «Отложено» and %). */
export type YearRow = { ym: string; name: string; income: string; spent: string; saved: string; pct: string; mark: '▲' | '▼' | ''; grey: boolean; pressable: boolean };

export function yearTable(r: YearReport): { rows: YearRow[]; total: string[]; average: string[] } {
  const n = (v: number) => formatShort(Math.round(v));
  const rows = r.months.map((m: YearMonth): YearRow => {
    const has = m.state === 'data';
    return {
      ym: m.ym, name: monthName(m.ym), grey: !has, pressable: has && m.hasPlan && m.ym < currentYm(),
      income: has ? n(m.income) : '—', spent: has ? n(m.spent) : '—',
      saved: has && m.saved !== null ? n(m.saved) : '—', pct: has && m.pct !== null ? `${m.pct < 0 ? '−' : ''}${Math.abs(m.pct)}` : '—',
      mark: r.best?.ym === m.ym ? '▲' : r.worst?.ym === m.ym ? '▼' : '',
    };
  });
  const pct = r.budget > 0 ? `${Math.round((r.saved / r.budget) * 100)}` : '—';
  // a month on average: whole units
  const per = (v: number) => (r.count ? n(Math.round(v / r.count / 100) * 100) : '—');
  return { rows, total: [n(r.income), n(r.spent), n(r.saved), pct], average: [per(r.income), per(r.spent), per(r.saved), ''] };
}

/** The first screen's lines: «Отложено за 10 месяцев», «38% бюджета · цель 15% ✓», «≈ … за год в таком темпе». */
export function yearLines(r: YearReport) {
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency);
  // «Отложено» in the budget currency of the year's last month with one
  const saved = (v: number) => formatWithCurrency(Math.round(r.savedIn ? v * r.savedIn.rate : v), r.savedIn?.currency ?? r.currency);
  const pct = r.budget > 0 ? Math.round((r.saved / r.budget) * 100) : null;
  return {
    money, saved,
    savedCaption: r.over ? `Отложено за ${r.year}` : `Отложено за ${months(r.count)}`,
    ofBudget: pct === null ? null : `${pct}% бюджета${r.goalPct !== null ? ` · цель ${r.goalPct}%${pct >= r.goalPct ? ' ✓' : ''}` : ''}`,
    pace: r.pace === null ? null : `≈ ${saved(r.pace)} за год в таком темпе`,
    inPlan: `${r.planMonths} из ${r.count} мес`,
    best: r.best ? { title: `${monthName(r.best.ym)}${r.best.pct !== null ? ` · ${r.best.pct}% бюджета` : ''}`, value: `+${money(r.best.saved)}` } : null,
    worst: r.worst ? {
      title: `${monthName(r.worst.ym)}${r.worst.reason ? ` · ${r.worst.reason}` : ''}`,
      value: `${r.worst.saved < 0 ? '−' : '+'}${money(Math.abs(r.worst.saved))}`,
    } : null,
  };
}

/** «из 1 месяца», «из 8 месяцев» */
const ofMonths = (n: number) => `${n} ${plural(n, ['месяца', 'месяцев', 'месяцев'])}`;

/**
 * «Траты по категориям»: under a category — «1 200 ₾ в месяц · перерасход в 3 из 8 месяцев» (none planned — «без
 * плана»), over the full months as the stats' «В среднем … в месяц»; a month's average in whole units.
 */
export const topNote = (c: Pick<YearReport['top'][number], 'perMonth' | 'overIn' | 'planned'>, money: (v: number) => string) =>
  [c.perMonth === null ? '' : `${money(Math.round(c.perMonth / 100) * 100)} в месяц`, c.planned ? `перерасход в ${c.overIn} из ${ofMonths(c.planned)}` : 'без плана']
    .filter(Boolean).join(' · ');

/** A fund of the year: «к 31 июля 2027 · успеваете» / «· не успеваете». */
export const fundNote = (f: YearReport['fundsNow'][number]) =>
  `к ${dayTitle(f.due)}${f.ok === null ? '' : f.ok ? ' · успеваете' : ' · не успеваете'}`;
