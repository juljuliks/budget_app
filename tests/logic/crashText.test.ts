// Crash reports (src/native/crashText.ts): what leaves the phone with a console.error.
import { reportOf } from '../../src/native/crashText';

test('the text and the Error\'s message and stack go; an object logged with them does not', () => {
  const e = new Error('no such table: plans');
  const r = reportOf(['save failed', { merchant: 'SPAR', amount_minor: 2500, raw_sms: 'TBC 25 GEL SPAR' }, e]);
  expect(r.message).toBe('save failed Error: no such table: plans');
  expect(r.stack).toBe(e.stack);
  expect(JSON.stringify(r)).not.toMatch(/SPAR|2500|GEL/);
});

test('nothing but an object: a stand-in title, the stack where it was logged', () => {
  const r = reportOf([{ amount_minor: 100 }]);
  expect(r.message).toBe('console.error');
  expect(r.stack).not.toMatch(/amount/);
});

test('a long text is cut', () => {
  expect(reportOf(['x'.repeat(2000)]).message).toHaveLength(500);
});
