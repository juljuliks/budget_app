import { NO_CATEGORY_EMOJI } from '@/colors';
import type { NormPeriod } from '@/db/plans';

// Shared wording, see GLOSSARY.md: one term per concept across the app.

export const CANCEL = 'Отмена';
export const SAVE = 'Сохранить';
export const DELETE = 'Удалить';
export const NO_CATEGORY = `${NO_CATEGORY_EMOJI} Без категории`;
export const NO_SECTION = 'Без раздела';
export const AMOUNT_HINT = 'Введите сумму, например 1500 или 12.50';
/** before a list of amounts that couldn't be converted */
export const NO_RATE = 'Не учтено — нет курса валюты (нужен интернет):';

/** A category's spending pattern (plan_items.norm_period), as the setting "Как тратите" names it. */
export const SPENDING_PATTERN: Record<NormPeriod, { title: string; hint: string }> = {
  day: { title: 'Каждый день', hint: 'Еда, транспорт — понемногу каждый день.' },
  week: { title: 'Раз в неделю', hint: 'Бары, кафе — раз-два в неделю.' },
  '2weeks': { title: 'Раз в 2 недели', hint: 'Траты раз в пару недель.' },
  month: { title: 'Крупно, раз в месяц', hint: 'Одежда, техника — пара покупок в месяц.' },
};

/** "в день" / "в неделю" / "за 2 недели" / "в месяц": a limit per its period ("≈ 113 ₾ в неделю"). */
export const PER_PERIOD: Record<NormPeriod, string> = { day: 'в день', week: 'в неделю', '2weeks': 'за 2 недели', month: 'в месяц' };

/** "на день" / "на неделю" / "на 2 недели": the limit of a period ("лимит на неделю"). */
export const FOR_PERIOD: Record<Exclude<NormPeriod, 'month'>, string> = { day: 'на день', week: 'на неделю', '2weeks': 'на 2 недели' };
