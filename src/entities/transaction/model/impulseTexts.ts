// «Покупки по дням»: the calendar of purchases and their answers (a category's «Динамика», the month's report).
/** purchases on a month's calendar, under «Импульсивные покупки» */
export const BY_DAY = 'Покупки по дням';
export const BY_DAY_HINT = 'Нажмите на день с отметкой — покупки дня';
export const NO_PURCHASES = 'Покупок не было';
/** a purchase's answer in a tapped day's card */
export const MARK_TEXTS = {
  impulsive: 'Импульсивная',
  intentional: 'Обдуманная',
  unanswered: 'Без ответа — ответить в операции',
} as const;
export const MARK_LEGEND = { impulsive: 'импульсивная', intentional: 'обдуманная', unanswered: 'без ответа' } as const;
