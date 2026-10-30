// «Динамика трат»: the words of the dashboard and of a category's page (GLOSSARY.md: «обычно», «к обычному»).
import type { TrendMode } from '@/stats/trends';

export const TRENDS_TITLE = 'Динамика трат';
export const MODES: ReadonlyArray<readonly [TrendMode, string]> = [['week', 'Неделя'], ['month', 'Месяц']];
/** under the switch: what is put against what */
export const MODE_HINT: Record<TrendMode, string> = {
  week: 'Эта неделя по сегодня — к обычной неделе по те же дни (медиана 8 прошлых недель)',
  month: 'Этот месяц по сегодня — к обычному по те же дни (медиана 3 прошлых месяцев)',
};
export const MORE = 'Больше обычного';
export const LESS = 'Меньше обычного';
export const NO_CHANGES = 'Больших изменений нет';
export const ALL_CATEGORIES = 'Все категории';
export const PICK_TITLE = 'Категория';
export const LEGEND_THIS_WEEK = 'эта неделя';
export const LEGEND_USUAL_DAY = 'обычно в этот день';
/** too little history for a usual */
export const TOO_EARLY: Record<TrendMode, string> = {
  week: 'Обычная неделя появится, когда наберётся 8 недель трат.',
  month: 'Обычный месяц появится, когда наберётся 3 месяца трат.',
};
export const NOT_COMPARED = 'Платёж раз в период — по дням с обычным не сравнивается';
export const WHY = 'Почему';
export const BY_WEEKDAY = 'По дням недели · последние 3 месяца';
export const AVERAGE = 'В среднем в месяц';
export const TOTAL = 'За 12 месяцев';
export const LEAST = 'Меньше всего';
export const MOST = 'Больше всего';
export const MERCHANTS: Record<TrendMode, string> = { week: 'Мерчанты · эта неделя', month: 'Мерчанты · этот месяц' };
export const TAP_BAR: Record<TrendMode, string> = {
  week: 'Нажмите на день — сумма и сколько обычно',
  month: 'Нажмите на столбик — сумма месяца',
};
export const SPENT_WHEN: Record<TrendMode, string> = { week: 'за неделю', month: 'в этом месяце' };
