import {
  addMonths, chargesBetween, isDone, monthCharges, nextCharge, offeredDue,
} from '../../src/db/subscriptions/schedule';

describe('subscription schedule', () => {
  test('a day past the month end is its last day; each charge counted from the set day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-18', -1)).toBe('2026-09-18');
    expect(addMonths('2026-03-12', 12)).toBe('2027-03-12');
  });

  test('the charges between two days, back and forth from the set day', () => {
    expect(chargesBetween('2026-11-18', 1, '2026-10-01', '2027-01-31')).toEqual(['2026-10-18', '2026-11-18', '2026-12-18', '2027-01-18']);
    expect(chargesBetween('2027-03-12', 12, '2026-01-01', '2027-12-31')).toEqual(['2026-03-12', '2027-03-12']);
    expect(chargesBetween('2026-10-29', 3, '2026-11-01', '2026-12-31')).toEqual([]);
  });

  test('a charge is done by an operation within 7 days of it', () => {
    expect(isDone('2026-10-18', ['2026-10-25'])).toBe(true);
    expect(isDone('2026-10-18', ['2026-10-11'])).toBe(true);
    expect(isDone('2026-10-18', ['2026-10-26', '2026-10-10'])).toBe(false);
  });

  test('the next charge: the first not done whose window has not passed', () => {
    // set to 18 Nov: before it nothing is waited for
    expect(nextCharge('2026-11-18', 1, ['2026-10-18'], '2026-10-18')).toBe('2026-11-18');
    // charged a day late — the next is December's
    expect(nextCharge('2026-11-18', 1, ['2026-10-18', '2026-11-19'], '2026-11-20')).toBe('2026-12-18');
    // not charged yet, within the window — still November's
    expect(nextCharge('2026-11-18', 1, ['2026-10-18'], '2026-11-22')).toBe('2026-11-18');
    // missed more than 7 days ago — not waited for
    expect(nextCharge('2026-11-18', 1, ['2026-10-18'], '2026-11-26')).toBe('2026-12-18');
  });

  test("the month's charges: the done one before the set day counts, the plan's month from when it was made", () => {
    // made in October from the operation of 18 Oct, next set to 18 Nov
    expect(monthCharges('2026-11-18', 1, '2026-10', ['2026-10-18'], '2026-10-01')).toEqual([{ day: '2026-10-18', done: true }]);
    expect(monthCharges('2026-11-18', 1, '2026-11', ['2026-10-18'], '2026-10-01')).toEqual([{ day: '2026-11-18', done: false }]);
    // made in October with no operation: October has nothing
    expect(monthCharges('2026-11-18', 1, '2026-10', [], '2026-10-01')).toEqual([]);
    // a year one: only its month
    expect(monthCharges('2027-03-12', 12, '2026-12', [], '2026-10-01')).toEqual([]);
    expect(monthCharges('2027-03-12', 12, '2027-03', [], '2026-10-01')).toEqual([{ day: '2027-03-12', done: false }]);
  });

  test('the day offered: the last operation plus the period, not in the past', () => {
    expect(offeredDue('2026-10-18', 1, '2026-10-18')).toBe('2026-11-18');
    expect(offeredDue('2026-10-02', 1, '2026-10-18')).toBe('2026-11-02');
    expect(offeredDue('2026-07-02', 1, '2026-10-18')).toBe('2026-11-02');
    expect(offeredDue('2026-03-12', 12, '2026-10-18')).toBe('2027-03-12');
  });
});
