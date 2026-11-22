// A report opened from anywhere (a row, «История», a notification, the year's bars): as stories while fresh (the
// 24th of its month to the 7th of the next; the year's — 24 December to 7 January), else as its page.
import { isMonthFresh, isYearFresh } from '@/stats/reportWindow';
import { navigateWhenReady, openMonthReportPage } from './navigation';
import { openMonthReport, openYearReport } from './sheets';

/** A month's report: its stories while fresh, else its page. */
export function openReport(ym: string) {
  if (isMonthFresh(ym)) openMonthReport(ym);
  else openMonthReportPage(ym);
}

/** «Итоги 2026»: the stories while fresh, else «Статистика за год» on that year. */
export function openYear(year: number) {
  if (isYearFresh(year)) openYearReport(year);
  else navigateWhenReady({ name: 'Main', params: { screen: 'Stats', params: { year, nonce: Date.now() } } } as never);
}
