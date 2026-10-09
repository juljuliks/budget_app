// The screens' tests: native parts the app uses, replaced (no device here).
/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock('@notifee/react-native', () => {
  const mock = require('@notifee/react-native/jest-mock');
  // no notification opened the app
  return { ...mock, __esModule: true, default: { ...mock.default, getInitialNotification: jest.fn(async () => null) } };
});
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const C = (props: { children?: unknown }) => React.createElement(View, null, props.children);
  return new Proxy({ __esModule: true, default: C }, { get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : C) });
});

// Lists render every row they have (no layout here to window them by): the next page still loads on endReached.
function mockUnwindowed(path: string, name: string) {
  const React = require('react');
  const actual = jest.requireActual(path);
  const List = actual.default ?? actual;
  const Wrapped = React.forwardRef((props: object, ref: unknown) =>
    React.createElement(List, { ...props, ref, disableVirtualization: true, initialNumToRender: 100000, maxToRenderPerBatch: 100000 }));
  Wrapped.displayName = name;
  return actual.default ? { ...actual, __esModule: true, default: Wrapped } : Wrapped;
}
jest.mock('react-native/Libraries/Lists/SectionList', () => mockUnwindowed('react-native/Libraries/Lists/SectionList', 'SectionList'));
jest.mock('react-native/Libraries/Lists/FlatList', () => mockUnwindowed('react-native/Libraries/Lists/FlatList', 'FlatList'));

// "Today" is Thursday 15 October 2026, noon, and the time goes on from there: the pace, the weeks and "осталось до …"
// don't depend on when the tests run, and animations (timed by the clock) still finish.
{
  const RealDate = Date;
  const offset = new RealDate(2026, 9, 15, 12, 0, 0).getTime() - RealDate.now();
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...(args as [number]));
    }
    static now() { return RealDate.now() + offset; }
  }
  global.Date = ShiftedDate as DateConstructor;
}
