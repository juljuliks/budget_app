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
 * The words of a category's repeating payments: with "Подписки" (its merchants') — subscriptions ("Подписка «Netflix»",
 * "Удалить подписку"), else its own regular payment ("Платёж «…»").
 */
export function paymentWords(byMerchant: boolean) {
  return byMerchant
    ? {
      One: 'Подписка', one: 'подписка', acc: 'подписку', deleted: 'удалена', noneHas: 'ни у одной подписки',
      toAll: 'подпискам', noDated: 'нет подписок с датой', none: 'нет подписок',
      upcoming: 'Предстоящие подписки', Many: 'Подписки', subscriptions: true,
    }
    : {
      One: 'Платёж', one: 'платёж', acc: 'платёж', deleted: 'удалён', noneHas: 'ни у одного платежа',
      toAll: 'платежам', noDated: 'нет платежей с датой', none: 'нет платежей',
      upcoming: 'Предстоящие платежи', Many: 'Платежи', subscriptions: false,
    };
}
export type PaymentWords = ReturnType<typeof paymentWords>;

/** A subscription's words: the subscriptions' sheets are a category with "Подписки"'s only. */
export const SUBSCRIPTION_WORDS = paymentWords(true);
