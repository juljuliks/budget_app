// What a fund's card says about its date: «✓ Успеваете к 31 июля» / «⚠ Не успеваете к 31 июля», why, and what to do. No React.
import type { FundForecast } from '@/db/plans';
import { dayTitle, MONTHS_GEN } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';

/** «31 июля» — without the year */
const dayMonth = (key: string) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS_GEN[m - 1]}`; };

export type ForecastText = {
  ok: boolean;
  title: string;
  lines: string[];
  /** late: «Сдвинуть на 30 сентября 2027» (none — not within 10 years) */
  move: { label: string; due: string } | null;
  /** late: «Копить 1 185 $ к 31 июля» (none — nothing more than it has) */
  keep: { label: string; target: number } | null;
};

export function forecastText(f: FundForecast): ForecastText {
  const money = (v: number) => formatWithCurrency(v, f.currency);
  const by = dayMonth(f.due);
  const parts = `свободно в плане ${money(f.fromFree)}${f.fromLocked > 0 ? ` + из 🔒 ${money(f.fromLocked)}` : ''}`;
  if (f.status === 'ok') {
    return {
      ok: true,
      title: `✓ Успеваете к ${by}`,
      lines: [
        f.fromLocked > 0 ? `Взнос ${money(f.asked)} в месяц влезает: ${parts}.`
          : `Взнос ${money(f.asked)} в месяц влезает: свободно в плане ${money(f.free)}, 🔒 не трогаем.`,
        `В таком темпе ${money(f.target)} будут к ${dayTitle(f.due)}.`,
      ],
      move: null, keep: null,
    };
  }
  const got = f.fromFree + f.fromLocked;
  return {
    ok: false,
    title: `⚠ Не успеваете к ${by}`,
    lines: [
      f.status === 'full'
        ? `Нужно ${money(f.asked)} в месяц, а бюджет расписан: копилке ничего не остаётся (сначала — копилки с датой раньше).`
        : `Нужно ${money(f.asked)} в месяц, а копилке остаётся ${money(got)}: ${parts} (сначала — копилки с датой раньше).`,
      `В таком темпе к ${by} будет ≈ ${money(f.forecast)} из ${money(f.target)}.`,
    ],
    move: f.moveTo ? { label: `Сдвинуть на ${dayTitle(f.moveTo)}`, due: f.moveTo } : null,
    keep: f.forecast > f.saved ? { label: `Копить ${money(f.forecast)} к ${by}`, target: f.forecast } : null,
  };
}
