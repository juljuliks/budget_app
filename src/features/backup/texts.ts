import type { BackupProblem } from '@/backup';

// "Резервная копия" (Настройки), see GLOSSARY.md.

export const BACKUP = 'Резервная копия';
export const BACKUP_INFO =
  'Все операции, категории, мерчанты и план — одним файлом. Сохраните его в «Загрузки» или на Google Диск: на новом телефоне из него всё восстановится.';
export const SAVE_BACKUP = 'Сохранить копию';
export const RESTORE_BACKUP = 'Восстановить из копии';
export const EXPORT_CSV = 'Экспорт CSV';
export const SAVED = 'Копия сохранена';
export const CSV_SAVED = 'Таблица операций сохранена';
export const RESTORE_QUESTION = 'Восстановить из копии?';
export const RESTORE_INFO = 'Операции, категории, мерчанты и план заменятся данными из файла. Приложение перезапустится.';
export const RESTORE = 'Восстановить';
export const NOT_SUITABLE = 'Этот файл не подходит';
export const FAILED = 'Не получилось';

export const PROBLEMS: Record<BackupProblem, string> = {
  'not-db': 'Это не резервная копия приложения: выберите файл budget-….db.',
  broken: 'Файл повреждён. Выберите другую копию.',
  'not-ours': 'Это файл другого приложения: выберите копию budget-….db.',
  newer: 'Копия сделана более новой версией приложения. Сначала обновите приложение.',
};

export const AUTO = 'Автокопия';
export const AUTO_INFO =
  'Раз в неделю, когда вы открываете приложение, копия сохраняется в выбранную папку — например, Documents или новую (Download и корень памяти Android выбрать не даёт). Хранятся две последние: budget-auto-….db. Папка на Google Диске — и копии будут ещё и в облаке.';
export const autoStatus = (folder: string) => `Раз в неделю в папку «${folder}», хранятся две последние.`;
export const AUTO_FIRST = 'Первая — при следующем открытии приложения.';
export const AUTO_GONE = 'Папка недоступна (удалена или нет доступа): выберите другую.';
export const PICK_FOLDER = 'Выбрать папку';
export const CHANGE_FOLDER = 'Сменить папку';
export const AUTO_ON = 'Автокопия включена';
export const AUTO_OFF = 'Автокопия выключена';
export const AUTO_FAILED = 'Автокопия не сохранилась: выберите папку заново';

export const PASSWORD = 'Пароль для копий';
export const PASSWORD_INFO =
  'Копии и автокопии будут зашифрованы: файл откроется только с паролем, на любом телефоне. Запишите его — без пароля такую копию не восстановить. Копии, сохранённые раньше, и экспорт CSV не шифруются.';
export const SET_PASSWORD = 'Задать пароль';
export const SET_PASSWORD_INFO = 'Не короче 8 символов; лучше несколько слов. Запишите его: без пароля копию не восстановить.';
export const PASSWORD_FIELD = 'Пароль';
export const PASSWORD_REPEAT = 'Повторите пароль';
export const MIN_PASSWORD = 8;
export const PASSWORD_SHORT = 'Пароль — не короче 8 символов';
export const PASSWORD_MISMATCH = 'Пароли не совпадают';
export const PASSWORD_SET = 'Пароль для копий задан';
export const PASSWORD_REMOVED = 'Пароль для копий убран';
export const ENTER_PASSWORD = 'Пароль копии';
export const ENTER_PASSWORD_INFO = 'Копия зашифрована: введите пароль, заданный при её сохранении.';
export const WRONG_PASSWORD = 'Неверный пароль';
export const AUTO_OFF_HINT = 'Раз в неделю — копия в выбранную папку.';
export const PASSWORD_ON_HINT = 'Копии шифруются: без пароля их не восстановить.';
export const PASSWORD_OFF_HINT = 'Копии не шифруются.';
export const CHANGE_PASSWORD = 'Сменить пароль';

// «На Google Диске»: the automatic copy to the app's folder on Google Drive, always encrypted
export const CLOUD = 'На Google Диске';
export const CLOUD_INFO =
  'Раз в неделю, когда вы открываете приложение, копия уходит в скрытую папку приложения на вашем Google Диске — её видит только это приложение. Хранятся четыре последние. Копия всегда зашифрована паролем для копий: без него её не восстановить.';
export const SIGN_IN = 'Войти через Google';
export const CHANGE_ACCOUNT = 'Сменить аккаунт';
export const cloudHint = (account: string) => `Аккаунт ${account}. Копии зашифрованы паролем.`;
export const CLOUD_OFF_HINT = 'Автокопия — в папку на телефоне. На Google Диск — только зашифрованной.';
export const cloudStatus = (account: string) => `Раз в неделю на Google Диск (${account}), хранятся четыре последние.`;
export const CLOUD_ON = 'Автокопия — на Google Диске';
export const CLOUD_FAILED = 'Автокопия не ушла на Google Диск: нет сети или доступа к аккаунту';
export const CLOUD_NEEDS_PASSWORD = 'Без пароля — только в папку';
export const CLOUD_NEEDS_PASSWORD_INFO = 'Копии на Google Диске хранятся только зашифрованными. Чтобы убрать пароль, сначала переключите автокопию в папку на телефоне.';
export const RESTORE_FROM = 'Откуда восстановить?';
export const FROM_FILE = 'Из файла';
export const FROM_CLOUD = 'С Google Диска';
export const NO_CLOUD_COPIES = 'На Google Диске копий нет';
export const noCloudCopiesInfo = (account: string) => `В аккаунте ${account} копий этого приложения нет.`;
export const PICK_CLOUD_COPY = 'Какую копию восстановить?';
