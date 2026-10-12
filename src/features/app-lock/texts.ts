import { plural } from '@/shared/lib/format';

// "Блокировка" (Настройки), the lock screen, the PIN windows; see GLOSSARY.md.

export const LOCK = 'Блокировка';
export const LOCK_OFF_HINT = 'Приложение открывается без входа';
export const LOCK_PIN_HINT = 'Вход по PIN-коду';
export const LOCK_BIO_HINT = 'Вход по PIN-коду или отпечатку';
export const BIOMETRIC = 'Отпечаток или лицо';
export const DELAY = 'Спрашивать после сворачивания';
export const DELAYS: ReadonlyArray<readonly [string, string]> = [['0', 'Сразу'], ['60', '1 мин'], ['300', '5 мин'], ['900', '15 мин']];
export const HIDE_NOTIFICATIONS = 'Скрывать суммы в уведомлениях';
export const HIDE_NOTIFICATIONS_HINT = 'В шторке — тип и мерчант, без суммы';
export const CHANGE_PIN = 'Сменить PIN-код';
/** under the switch while on: the lock's sheet */
export const SET_UP = 'Настроить';

export const ENTER_PIN = 'Введите PIN-код';
export const CURRENT_PIN = 'Текущий PIN-код';
export const NEW_PIN = 'Придумайте PIN-код';
export const NEW_PIN_CHANGE = 'Новый PIN-код';
export const NEW_PIN_HINT = 'От 4 до 6 цифр';
export const CONFIRM_PIN = 'Подтвердите PIN-код';
export const CONFIRM_PIN_HINT = 'Введите его ещё раз';
export const PIN_MISMATCH = 'PIN-коды не совпадают — введите ещё раз';
export const RESTART_PIN = 'Придумать заново';
export const NEXT = 'Дальше';
export const MIN_PIN = 4;
export const MAX_PIN = 6;
export const wrongPin = (left: number) => `Неверный PIN-код. Осталось попыток: ${left}`;
export const waitPin = (s: number) => `Слишком много попыток. Подождите ${s} ${plural(s, ['секунду', 'секунды', 'секунд'])}`;

export const TURN_OFF = 'Выключить блокировку';
export const TURN_OFF_HINT = 'Приложение будет открываться без входа';
export const SHOW_AMOUNTS = 'Показать суммы';
export const UNLOCK_TITLE = 'Вход в Budget';
export const BIO_SUBTITLE = 'Приложите палец к датчику';
export const USE_PIN = 'Ввести PIN-код';
export const BY_FINGERPRINT = 'Войти по отпечатку';
export const OFFER_TITLE = 'Входить по отпечатку?';
export const OFFER_INFO = 'Быстрее, чем PIN-код. PIN-код остаётся — на случай, если датчик не сработает.';
export const OFFER_YES = 'Включить отпечаток';
export const OFFER_NO = 'Не сейчас';

export const FORGOT = 'Забыли PIN-код?';
export const FORGOT_INFO_BIO = 'Войдите по отпечатку и задайте новый: Настройки → «Блокировка» → «Сменить PIN-код».';
export const FORGOT_INFO =
  'Отпечаток не включён: остаётся только переустановить приложение и восстановить данные из резервной копии. Без копии операции, план и категории пропадут.';
export const CLOSE = 'Закрыть';

export const LOCK_ON = 'Блокировка включена';
export const LOCK_OFF = 'Блокировка выключена';
export const PIN_CHANGED = 'PIN-код изменён';
