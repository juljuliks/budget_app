// A fund's card: «Успеваете» / «Не успеваете» and the two ways out (features/fund/model/forecastText.ts).
import { forecastText } from '../../src/features/fund/model/forecastText';
import type { FundForecast } from '../../src/db/plans';

/** the amounts' no-break spaces as plain ones */
const text = (f: FundForecast) => JSON.parse(JSON.stringify(forecastText(f)).replace(/[\u00a0\u202f]/g, ' '));
const f = (x: Partial<FundForecast>): FundForecast => ({
  category_id: 1,
  currency: 'USD',
  target: 150000,
  due: '2027-07-31',
  saved: 42000,
  status: 'ok',
  asked: 12000,
  fromFree: 12000,
  fromLocked: 0,
  free: 14000,
  locked: 4500,
  forecast: 150000,
  moveTo: null,
  ...x,
});

test('ok: the contribution fits — of the free part, or of 🔒 too', () => {
  expect(text(f({}))).toEqual({
    ok: true,
    title: '✓ Успеваете к 31 июля',
    lines: [
      'Взнос 120 $ в месяц влезает: свободно в плане 140 $, 🔒 не трогаем.',
      'В таком темпе 1 500 $ будут к 31 июля 2027.',
    ],
    move: null,
    keep: null,
  });
  expect(text(f({ fromFree: 7500, fromLocked: 4500 })).lines[0]).toBe(
    'Взнос 120 $ в месяц влезает: свободно в плане 75 $ + из 🔒 45 $.',
  );
});

test('late: what is left for it, the pace, «Сдвинуть на …» and «Копить … к …»', () => {
  expect(text(f({ status: 'late', fromFree: 4000, fromLocked: 4500, forecast: 118500, moveTo: '2027-09-30' }))).toEqual(
    {
      ok: false,
      title: '⚠ Не успеваете к 31 июля',
      lines: [
        'Нужно 120 $ в месяц, а копилке остаётся 85 $: свободно в плане 40 $ + из 🔒 45 $ (сначала — копилки с датой раньше).',
        'В таком темпе к 31 июля будет ≈ 1 185 $ из 1 500 $.',
      ],
      move: { label: 'Сдвинуть на 30 сентября 2027', due: '2027-09-30' },
      keep: { label: 'Копить 1 185 $ к 31 июля', target: 118500 },
    },
  );
  const full = text(f({ status: 'full', fromFree: 0, fromLocked: 0, forecast: 42000, moveTo: null }));
  expect(full.lines[0]).toBe(
    'Нужно 120 $ в месяц, а бюджет расписан: копилке ничего не остаётся (сначала — копилки с датой раньше).',
  );
  expect([full.move, full.keep]).toEqual([null, null]);
});
