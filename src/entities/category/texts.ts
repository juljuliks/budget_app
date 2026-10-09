// The category sheet's longer texts.
import { TOP_UP } from '@/db/categories';

/** Under the name of a system category: what goes there, why it can't be renamed or deleted. */
export function systemCategoryHint(systemKind: string): string {
  return systemKind === TOP_UP
    ? 'Системная категория: сюда попадают все пополнения карты — деньги, которые пришли за месяц и которые вы распределяете. Это не траты. Если пополнение — возврат долга от человека, перенесите его в категорию переводов. Название не меняется, удалить её нельзя.'
    : 'Системная категория: сюда уходит то, что бюджет месяца оставил (не запланировано и не потрачено). Операции в ней — отложенные деньги, не траты. Название не меняется, удалить её нельзя.';
}

export const QUICK_HINT = 'Цвет подберётся сам. Изменить категорию полностью можно в Настройки → Категории.';
