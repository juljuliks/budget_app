// The app as the screens' tests see it: a fresh in-memory database with a seed (tests/e2e/seeds.ts), then <App />.
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import App from '../../src/app/App';
import { freshDb } from '../helpers';
import { done } from '../e2e/seeds';
import { setHideAmounts } from '../../src/hideAmounts';
import { setDisplayCurrency } from '../../src/displayCurrency';

/** The app on a fresh database filled by `seed`, the operations shown. */
export async function openApp(seed?: () => Promise<void>) {
  await freshDb();
  if (seed) await seed();
  await done();
  // module-level settings carried over from a previous test of the file
  await setHideAmounts(false);
  await setDisplayCurrency('GEL');
  render(<App />);
  await screen.findByPlaceholderText('Поиск: мерчант, заметка, сумма…');
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

type Element = ReturnType<typeof screen.getByText>;

/**
 * The element, waiting for it to show: in the topmost open sheet when one is open (it covers the page and its
 * header), else the last match on the page.
 */
async function find(what: string | RegExp) {
  return waitFor(() => {
    if (typeof what === 'string' && what.startsWith('#')) return screen.getByTestId(what.slice(1));
    // the open sheets (one sliding away is still drawn but not open)
    const sheets = screen.UNSAFE_root.findAll((n: { type: { name?: string }; props: { visible?: unknown } }) =>
      n.type?.name === 'BottomSheet' && n.props.visible === true);
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

/** Настройки → a screen of them ("Мерчанты", "Категории"). */
export async function openSettings(row: 'Мерчанты' | 'Категории') {
  await tap('Настройки');
  await tap(row);
}

/** The switch on the screen (the last one: a sheet's), toggled. */
/** The last switch of the topmost open sheet (a closed one keeps its content drawn), else of the page. */
export function toggleSwitch(on: boolean) {
  const sheets = screen.UNSAFE_root.findAll((n: { type: { name?: string }; props: { visible?: unknown } }) =>
    n.type?.name === 'BottomSheet' && n.props.visible === true);
  const root = sheets.length ? sheets[sheets.length - 1] : screen.UNSAFE_root;
  const all = root.findAll((n: { props: { onValueChange?: unknown } }) => typeof n.props.onValueChange === 'function');
  fireEvent(all[all.length - 1], 'valueChange', on);
}

export { screen };
