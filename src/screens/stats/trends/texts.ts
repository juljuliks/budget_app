// «Динамика трат»: the words of the dashboard and of a category's page (GLOSSARY.md: «обычно», «к обычному»).
export const TRENDS_TITLE = 'Динамика трат';
/** on top: what is put against what */
export const MODE_HINT = 'Этот месяц по сегодня — к обычному по те же дни (медиана до 6 прошлых месяцев); показаны те, что вышли за привычный разброс';
export const MORE = 'Больше обычного';
export const LESS = 'Меньше обычного';
export const NO_CHANGES = 'Больших изменений нет';
export const ALL_CATEGORIES = 'Все категории';
export const PICK_TITLE = 'Категория';
/** too little history for a usual */
export const TOO_EARLY = 'Обычный месяц появится, когда наберётся 3 месяца трат.';
/** a category spent in fewer than 2 full months: its page isn't picked by how often yet (stats/trendKind.ts) */
export const FEW_DATA = 'Мало данных: нужно 2 полных месяца с тратами, чтобы понять, частые это траты или редкие (как аренда). Пока — как у частых.';
export const NOT_COMPARED = 'Платёж раз в период — по дням с обычным не сравнивается';
export const WHY = 'Почему';
export const BY_WEEKDAY = 'По дням недели · последние 3 месяца';
/** under the weekdays' bars: what the colored and the grey ones are, a tap */
export const WEEK_LEGEND = 'Цветом — эта неделя, серым — обычно в этот день. Нажмите на день — сумма';
export const AVERAGE = 'В среднем в месяц';
export const TOTAL = 'За 12 месяцев';
export const LEAST = 'Меньше всего';
export const MOST = 'Больше всего';
export const MERCHANTS = 'Мерчанты';
/** over a category's merchants: this month, this year (from January 1st), all the time */
export const MERCHANT_PERIODS = [['month', 'Месяц'], ['year', 'Год'], ['all', 'Всё время']] as const;
export const NO_MERCHANTS = 'Трат у мерчантов нет';
export const TAP_BAR = 'Нажмите на столбик — сумма месяца';
export const SPENT_WHEN = 'в этом месяце';
