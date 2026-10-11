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
export const AUTO_LABEL_OFF = 'Автокопия: выключена';
export const AUTO_LABEL_ON = 'Автокопия: раз в неделю';
export const AUTO_INFO =
  'Раз в неделю, когда вы открываете приложение, копия сохраняется в выбранную папку — например, Documents или новую (Download и корень памяти Android выбрать не даёт). Хранятся две последние: budget-auto-….db. Папка на Google Диске — и копии будут ещё и в облаке.';
export const autoStatus = (folder: string) => `Раз в неделю в папку «${folder}», хранятся две последние.`;
export const AUTO_FIRST = 'Первая — при следующем открытии приложения.';
export const AUTO_GONE = 'Папка недоступна (удалена или нет доступа): выберите другую.';
export const PICK_FOLDER = 'Выбрать папку';
export const CHANGE_FOLDER = 'Сменить папку';
export const TURN_OFF = 'Выключить';
export const AUTO_ON = 'Автокопия включена';
export const AUTO_OFF = 'Автокопия выключена';
export const AUTO_FAILED = 'Автокопия не сохранилась: выберите папку заново';
