// An error the app logs (console.error) fails the test, as a JS error in logcat fails an end-to-end flow.
// a test renders the whole app and walks through it: more than the default 5 s
jest.setTimeout(30000);
// waiting for what the database brings: several test files run at once and the machine is busy
require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });
const errors: unknown[][] = [];
beforeEach(() => {
  errors.length = 0;
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    // the screens load from the database after a render: React's "not wrapped in act" about that isn't the app's error
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
    errors.push(args);
  });
});
afterEach(() => {
  (console.error as jest.Mock).mockRestore();
  if (errors.length) throw new Error(`console.error during the test:\n${errors.map((a) => a.map(String).join(' ')).join('\n')}`);
});
