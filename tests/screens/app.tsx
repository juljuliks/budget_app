// The app as the screens' tests see it: a fresh in-memory database with a seed (tests/e2e/seeds.ts), then <App />.
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import App from '../../src/app/App';
import { freshDb } from '../helpers';
import { done } from '../e2e/seeds';
import { setHideAmounts } from '../../src/shared/settings/hideAmounts';
import { setDisplayCurrency } from '../../src/shared/settings/displayCurrency';
import { setRowMenuUsed } from '../../src/shared/settings/rowMenuHint';
import { setSelectUsed } from '../../src/shared/settings/selectHint';
import { resetLockedPct } from '../../src/shared/settings/lockedPct';
import { navigationRef } from '../../src/shared/navigation/navigation';

/** The app on a fresh database filled by `seed`, the operations shown. */
export async function openApp(seed?: () => Promise<void>) {
  await freshDb();
  if (seed) await seed();
  await done();
  // module-level settings carried over from a previous test of the file
  await setHideAmounts(false);
  await setDisplayCurrency('GEL');
  await setRowMenuUsed(false);
  await setSelectUsed(false);
  resetLockedPct();
  render(<App />);
  await screen.findByPlaceholderText('Поиск: мерчант, описание, сумма…');
}

/** Taps the element with this text (or label, or "#test id"), waiting for it to show. */
export async function tap(what: string | RegExp | Element) {
  const el = typeof what === 'string' || what instanceof RegExp ? await find(what) : what;
  // as a finger does: the press starts, then the tap (a row resets its long-press mark on press-in)
  fireEvent(el, 'pressIn');
  fireEvent.press(el);
}

export async function longPress(what: string | RegExp) {
  fireEvent(await find(what), 'longPress');
}

/** A long press's button over the finger (PressMenu): a category's «Операции» / «План» / «Динамика» in the stats. */
export async function pressAction(what: string | RegExp, action: string) {
  fireEvent(await find(what), 'longPress', { nativeEvent: { pageX: 200, pageY: 500 } });
  fireEvent.press(await screen.findByLabelText(action));
}

type Element = ReturnType<typeof screen.getByText>;

/**
 * The element, waiting for it to show: in the topmost open sheet or PIN window when one is open (it covers the page
 * and its header), else the last match on the page.
 */
async function find(what: string | RegExp) {
  return waitFor(() => {
    if (typeof what === 'string' && what.startsWith('#')) return screen.getByTestId(what.slice(1));
    // the open sheets (one sliding away is still drawn but not open) and the PIN windows over them (LockHost, last)
    const sheets = screen.UNSAFE_root.findAll((n: { type: { name?: string }; props: { visible?: unknown } }) =>
      (n.type?.name === 'BottomSheet' || n.type?.name === 'PinScreen') && n.props.visible === true);
    // a sheet open: only in the topmost one (what is under it can't be tapped; and its content may still be loading)
    for (const scope of sheets.length ? [within(sheets[sheets.length - 1])] : [screen]) {
      const byText = scope.queryAllByText(what);
      if (byText.length) return byText[byText.length - 1];
      const byLabel = scope.queryAllByLabelText(what);
      if (byLabel.length) return byLabel[byLabel.length - 1];
    }
    throw new Error(`no element "${String(what)}"`);
  });
}

/**
 * The pressable that holds this text (an operation's row, a chip, a button): to look inside it with `within` or tap it.
 * The last match (a sheet over the list comes after it).
 */
export function rowOf(text: string | RegExp) {
  const all = screen.getAllByText(text);
  let el: ReturnType<typeof screen.getByText> | null = all[all.length - 1];
  while (el && !(el.props && (el.props.onPress || el.props.onClick) && el.props.accessible !== false)) el = el.parent;
  if (!el) throw new Error(`no pressable around ${String(text)}`);
  return el;
}

/**
 * Scrolls a list (by its test id) down until `text` shows: the next pages load and the rows past the first batch
 * render (the test renderer has no layout, so the list is told its sizes). At most `pages` scrolls.
 */
export async function scrollTo(testId: string, text: string | RegExp, pages = 10) {
  for (let i = 0; i < pages; i++) {
    if (screen.queryAllByText(text).length) return;
    const list = screen.getByTestId(testId);
    fireEvent.scroll(list, {
      nativeEvent: { contentOffset: { y: 100000 }, contentSize: { height: 100500, width: 400 }, layoutMeasurement: { height: 800, width: 400 } },
    });
    fireEvent(list, 'endReached');
    // the next page from the database
    await act(() => new Promise((r) => setTimeout(r, 100)));
  }
  expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
}

/** Every text on the screen now, in order, nested texts joined into their line (for debugging and order checks). */
export function texts(): string[] {
  type Node = { type: unknown; parent: Node | null; children: Array<Node | string> };
  const flat = (n: Node | string): string => (typeof n === 'string' ? n : n.children.map(flat).join(''));
  const isText = (n: Node | null) => !!n && n.type === 'Text';
  return (screen.UNSAFE_root.findAll((n: Node) => isText(n) && !isText(n.parent?.parent ?? null) && !isText(n.parent)) as Node[])
    .map((n) => flat(n).replace(/\s/g, ' '));
}

/** The tab header's menu ⋮ → one of its pages ("Категории", "Мерчанты", "Настройки"). */
export async function openMenu(row: 'Категории' | 'Мерчанты' | 'Настройки') {
  await tap('Меню');
  await tap(row);
}

/** Настройки on a tab (opens on «Бюджет»), then a row of it when given (e.g. «Банки» on «Банки»). */
export async function openSettings(tab: 'Бюджет' | 'Банки' | 'Приложение' = 'Бюджет', row?: string) {
  await openMenu('Настройки');
  if (tab !== 'Бюджет') await tap(tab);
  if (row) await tap(row);
}

/** Back one page (the stack's header is native, not drawn here). */
export function back() {
  act(() => navigationRef.goBack());
}

/** Back from the pages over the tabs (the stack's header is native, not drawn here): to the tabs. */
export function backToTabs() {
  act(() => { while (navigationRef.canGoBack() && navigationRef.getRootState().routes.length > 1) navigationRef.goBack(); });
}

/** A tap in the hole of the month's donut («из 3 666 ₾ ✏️»): its budget's sheet. */
export function tapDonutCenter() {
  fireEvent(screen.getByTestId('month-budget'), 'responderRelease', { nativeEvent: { locationX: 110, locationY: 110 } });
}
/** From the month stats: its budget's sheet — a tap in the donut's hole, without a plan «Бюджет месяца ›». */
export async function openBudget() {
  await waitFor(() => expect(screen.queryByText(/^из .* ₾$/) ?? screen.queryByText('Бюджет месяца ›')).toBeTruthy());
  if (screen.queryByText(/^из .* ₾$/)) tapDonutCenter();
  else await tap('Бюджет месяца ›');
}
/** From the month stats: a category's amount in the plan (its long press, «План» / «В план»). */
export async function openPlanOf(category: string | RegExp) {
  // the month's stats only (the operations under them have the same names)
  const row = await waitFor(() => { const all = within(screen.getByTestId('month-stats')).getAllByText(category); return all[all.length - 1]; });
  fireEvent(row, 'longPress', { nativeEvent: { pageX: 200, pageY: 500 } });
  fireEvent.press(await screen.findByLabelText(/^(План|В план)$/));
}
/** From the stats: plan and spending by months, a page (the last item of the period list). */
export async function openHistoryPage() {
  await tap('Выбрать период');
  await tap('История по месяцам ›');
}
/** From the current month's stats: the next month's (its plan without spending). */
export async function openNextMonth() {
  await tap('Следующий месяц');
  await screen.findByLabelText('Добавить в план');
}

/** The switch on the screen (the last one: a sheet's), toggled. */
/**
 * The last switch of the topmost open sheet (a closed one keeps its content drawn), else of the page; with `label` —
 * the SwitchRow of that label ("Подписки" and "Импульсивные покупки" on a category's page).
 */
export function toggleSwitch(on: boolean, label?: string) {
  const sheets = screen.UNSAFE_root.findAll((n: { type: { name?: string }; props: { visible?: unknown } }) =>
    n.type?.name === 'BottomSheet' && n.props.visible === true);
  let root = sheets.length ? sheets[sheets.length - 1] : screen.UNSAFE_root;
  if (label) root = root.find((n: { type: { name?: string }; props: { label?: unknown } }) => n.type?.name === 'SwitchRow' && n.props.label === label);
  const all = root.findAll((n: { props: { onValueChange?: unknown } }) => typeof n.props.onValueChange === 'function');
  fireEvent(all[all.length - 1], 'valueChange', on);
}

export { screen };

/** The stories (a month's report, the year's): «Дальше ›» until `text` shows (at most `pages` times). */
export async function toStory(text: string | RegExp, pages = 7) {
  for (let i = 0; i < pages; i++) {
    if (screen.queryAllByText(text).length) return;
    await tap('Дальше ›');
  }
  expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
}

/** A month's report as stories (fresh, as from its banner or notification): the tests' today is past the window. */
export async function openStories(ym: string) {
  const { openMonthReport } = require('../../src/shared/navigation/sheets');
  act(() => openMonthReport(ym));
  const [y, m] = ym.split('-').map(Number);
  const { monthTitle } = require('../../src/shared/lib/dates');
  await screen.findByText(`Отчёт · ${monthTitle(y, m - 1)}`);
}

/** «Итоги …» as stories (fresh: 24 December — 7 January; the tests' today is not). */
export async function openYearStories(year: number) {
  const { openYearReport } = require('../../src/shared/navigation/sheets');
  act(() => openYearReport(year));
  await screen.findByText(`Итоги ${year}`);
}

