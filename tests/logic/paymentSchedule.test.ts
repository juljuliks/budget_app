import {
  addMonths, chargeBefore, chargesBetween, isDone, monthCharges, nextCharge, offeredDue, ONCE, savingFor, WEEKLY,
} from '../../src/db/recurring/schedule';

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

  test('every week: 4 or 5 charges a month, the window ± 3 days (one operation is one charge)', () => {
    expect(chargesBetween('2026-10-06', WEEKLY, '2026-10-01', '2026-10-31')).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
    expect(chargesBetween('2026-10-06', WEEKLY, '2026-12-01', '2026-12-31')).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29']);
    expect(chargesBetween('2026-10-06', -2, '2026-10-01', '2026-10-31')).toEqual(['2026-10-06', '2026-10-20']);
    expect(isDone('2026-10-13', ['2026-10-16'], WEEKLY)).toBe(true);
    expect(isDone('2026-10-13', ['2026-10-17'], WEEKLY)).toBe(false);
    // charged on the 14th — the next is the 20th; the 20th missed by more than 3 days — the 27th
    expect(nextCharge('2026-10-06', WEEKLY, ['2026-10-06', '2026-10-14'], '2026-10-15')).toBe('2026-10-20');
    expect(nextCharge('2026-10-06', WEEKLY, ['2026-10-14'], '2026-10-24')).toBe('2026-10-27');
    expect(offeredDue('2026-10-06', WEEKLY, '2026-10-15')).toBe('2026-10-20');
    expect(chargeBefore('2026-10-20', WEEKLY)).toBe('2026-10-13');
    expect(monthCharges('2026-10-20', WEEKLY, '2026-10', ['2026-10-13'], '2026-10-01')).toEqual([
      { day: '2026-10-13', done: true }, { day: '2026-10-20', done: false }, { day: '2026-10-27', done: false },
    ]);
  });

  test('once: its day only; done or missed — nothing next; offered — the operation it was made from', () => {
    expect(chargesBetween('2026-11-18', ONCE, '2026-01-01', '2027-12-31')).toEqual(['2026-11-18']);
    expect(chargesBetween('2026-11-18', ONCE, '2026-12-01', '2027-12-31')).toEqual([]);
    expect(monthCharges('2026-11-18', ONCE, '2026-11', [], '2026-10-01')).toEqual([{ day: '2026-11-18', done: false }]);
    expect(monthCharges('2026-11-18', ONCE, '2026-12', [], '2026-10-01')).toEqual([]);
    expect(nextCharge('2026-11-18', ONCE, [], '2026-10-18')).toBe('2026-11-18');
    expect(nextCharge('2026-11-18', ONCE, ['2026-11-18'], '2026-11-19')).toBeNull();
    expect(nextCharge('2026-11-18', ONCE, [], '2026-11-26')).toBeNull();
    expect(offeredDue('2026-10-13', ONCE, '2026-10-18')).toBe('2026-10-13');
    expect(chargeBefore('2026-10-13', ONCE)).toBe('2026-10-13');
    // saving up for it: the months before it save for it, none after
    expect(savingFor('2027-03-12', ONCE, '2026-11', [])).toBe('2027-03-12');
    expect(savingFor('2027-03-12', ONCE, '2027-04', [])).toBeNull();
  });
});
