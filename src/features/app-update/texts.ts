// «Обновить» (GLOSSARY.md: обновление).
export const UPDATE = 'Обновить';
export const updateAvailable = (version: string) => `Доступна версия ${version}`;
export const updateTo = (version: string) => `Обновить до ${version}`;
/** -1: the size isn't known yet */
export const downloading = (percent: number) => (percent >= 0 ? `Скачивается… ${percent}%` : 'Скачивается…');
export const LATEST = 'последняя';
export const ALLOW_TITLE = 'Разрешите установку';
export const ALLOW_TEXT =
  'Чтобы обновляться, приложению нужно разрешение «Установка неизвестных приложений». Включите его и нажмите «Обновить» ещё раз.';
export const OPEN_SETTINGS = 'Открыть настройки';
export const UPDATE_FAILED = 'Не удалось скачать обновление';
