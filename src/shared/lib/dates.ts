// The calendar words, one copy each: the months in the cases the texts need, the weekdays, the rhythms' lengths.

/** «Январь 2026»: a month's title */
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
/** «отчёт за январь» */
export const MONTHS_NOM = MONTHS.map((m) => m.toLowerCase());
/** «15 января» */
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «в январе» */
export const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
/** «15 янв» */
export const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** by `Date.getDay()`: «до пт» */
export const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** a limit's rhythm in days (a month's is its own length) */
export const RHYTHM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}
