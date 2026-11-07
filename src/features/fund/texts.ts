// A fund on its category's page: «Настроить» (the fields), its card.
import { plural } from '@/shared/lib/format';

export const FUND_SWITCH = 'Копилка';
export const SAVE_FUND = 'Сохранить копилку';
export const FUND_CARD = 'Копилка: взносы и траты';

export const months = (n: number) => `${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;
