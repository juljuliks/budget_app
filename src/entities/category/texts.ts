// The category sheet's longer texts.
import { OWN_TRANSFER } from '@/db/categories';

/** Under the name of a system category: what goes there, why it can't be renamed or deleted. */
export function systemCategoryHint(systemKind: string): string {
  if (systemKind === OWN_TRANSFER) {
    return 'Системная категория: переводы со своей карты на свою карту или свой счёт в другом банке (накопительный тоже). Поставьте её и на перевод, и на пополнение: это не траты и не доход, в статистику и план они не попадают. Название не меняется, удалить её нельзя.';
  }
  return 'Системная категория: сюда попадают все пополнения карты — деньги, которые пришли за месяц и которые вы распределяете. Это не траты. Если пополнение — возврат долга от человека, перенесите его в категорию переводов. Название не меняется, удалить её нельзя.';
}

export const QUICK_HINT = 'Цвет подберётся сам. Изменить категорию полностью можно в Настройки → Категории.';

/**
 * The words of a category's repeating payments: "Подписки" calls them repeating payments ("Подписка «Netflix»", "＋ Добавить
 * подписку"), any other — payments ("Платёж «…»", "＋ Добавить платёж").
 */
export function paymentWords(categoryName: string) {
  return categoryName.trim().toLowerCase() === 'подписки'
    ? {
      One: 'Подписка', one: 'подписка', acc: 'подписку', New: 'Новая подписка', deleted: 'удалена', noneHas: 'ни у одной подписки',
      toAll: 'подпискам', noDated: 'нет подписок с датой', like: 'Похожи на подписку', add: 'Добавить подписку',
    }
    : {
      One: 'Платёж', one: 'платёж', acc: 'платёж', New: 'Новый платёж', deleted: 'удалён', noneHas: 'ни у одного платежа',
      toAll: 'платежам', noDated: 'нет платежей с датой', like: 'Похожи на повторяющиеся', add: 'Добавить платёж',
    };
}
export type PaymentWords = ReturnType<typeof paymentWords>;

/** Under the switch "Повторяющиеся платежи". */
export const RECURRING_HINT = 'У мерчанта в категории — платёж: как часто и когда следующее списание. Сумма в плане считается из списаний месяца, редкие можно откладывать каждый месяц.';
