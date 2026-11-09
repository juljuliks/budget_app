// The calendar words, one copy each: the months in the cases the texts need, the weekdays, the rhythms' lengths.

/** «Январь 2026»: a month's title */
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
/** «отчёт за январь» */
export const MONTHS_NOM = MONTHS.map((m) => m.toLowerCase());
/** «15 января» */
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «в январе» */
/** «к июню 2027»: by when */
export const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];

export const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
/** «15 янв» */
export const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** by `Date.getDay()`: «до пт» */
export const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** "к четвергу": Sunday first, as WEEKDAYS. */
export const WEEKDAYS_DAT = ['воскресенью', 'понедельнику', 'вторнику', 'среде', 'четвергу', 'пятнице', 'субботе'];

/** a limit's rhythm in days (a month's is its own length) */
export const RHYTHM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** «31 июля 2027» of a day key 'YYYY-MM-DD': a fund's date, always with the year */
export function dayTitle(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}

const parts = (day: string) => day.split('-').map(Number);

/** "18 октября". */
export const longDay = (day: string) => { const [, m, d] = parts(day); return `${d} ${MONTHS_GEN[m - 1]}`; };

/** "18 октября"; another year — "18 октября 2027". */
export const longDayYear = (day: string, now = new Date()) => `${longDay(day)}${parts(day)[0] === now.getFullYear() ? '' : ` ${parts(day)[0]}`}`;

/** "в октябре" of 'YYYY-MM'. */
export const inMonth = (ym: string) => `в ${MONTHS_PREP[Number(ym.slice(5)) - 1]}`;

/** "в октябре"; another year — "в сентябре 2027". */
export const inMonthYear = (ym: string, now = new Date()) =>
  `${inMonth(ym)}${Number(ym.slice(0, 4)) === now.getFullYear() ? '' : ` ${ym.slice(0, 4)}`}`;

/** "Октябрь" of 'YYYY-MM'; another year — "Декабрь 2025": a picked month of a chart over the year's turn. */
export const monthYear = (ym: string, now = new Date()) =>
  `${MONTHS[Number(ym.slice(5)) - 1]}${Number(ym.slice(0, 4)) === now.getFullYear() ? '' : ` ${ym.slice(0, 4)}`}`;

/** "октября" of 'YYYY-MM'. */
export const monthGen = (ym: string) => MONTHS_GEN[Number(ym.slice(5)) - 1];

/** "октября"; another year — "сентября 2027". */
export const monthGenYear = (ym: string, now = new Date()) =>
  `${monthGen(ym)}${Number(ym.slice(0, 4)) === now.getFullYear() ? '' : ` ${ym.slice(0, 4)}`}`;
