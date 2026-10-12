// "Не распознано" and "Шаблоны сообщений": the words of the marking, its roles and types (GLOSSARY.md).
import type { Kind } from '@/domain/types';
import type { MessageSource } from '@/db/messages';
import type { Role } from '@/parsers/template';

export const UNPARSED = 'Не распознано';
export const TEMPLATES = 'Шаблоны сообщений';
export const UNPARSED_HINT = 'Сообщения банка, из которых не получилась операция. Отметьте в тексте сумму и валюту — такие будут разбираться сами. Хранятся 30 дней.';

export const sourceLabel = (s: MessageSource) => (s === 'push' ? 'Уведомление TBC' : 'SMS · TBC');

/** The roles a word can be marked with, and their colors (told apart by lightness too) */
export const ROLES: Array<{ role: Role; label: string; bg: string; fg: string; line: string }> = [
  { role: 'amount', label: 'Сумма', bg: '#DBEAFE', fg: '#1E3A8A', line: '#2563EB' },
  { role: 'currency', label: 'Валюта', bg: '#FCE7F3', fg: '#831843', line: '#DB2777' },
  { role: 'merchant', label: 'Мерчант', bg: '#FFEDD5', fg: '#7C2D12', line: '#EA580C' },
  { role: 'date', label: 'Дата и время', bg: '#EDE9FE', fg: '#4C1D95', line: '#7C3AED' },
  { role: 'balance', label: 'Баланс', bg: '#D1FAE5', fg: '#064E3B', line: '#059669' },
];

/** The types a marked message can be */
export const KINDS: Array<[Kind, string]> = [
  ['purchase', 'Покупка'], ['transfer', 'Перевод'], ['deposit', 'Пополнение'], ['refund', 'Возврат'], ['withdrawal', 'Снятие наличных'],
];

export const STEP_ROLE = '1 · Выберите, что отмечаете';
export const STEP_WORDS = '2 · Нажмите на слова в тексте';
export const WORDS_HINT = 'Мерчант и дата — одно или несколько слов подряд. Повторное нажатие снимает отметку.';
export const STEP_KIND = '3 · Тип операции';
export const STEP_RESULT = '4 · Результат';

export const NEXT = 'Дальше: к каким подойдёт';
export const ONLY_THIS = 'Создать только эту операцию';
export const HIDE_SUCH = 'Не операция — скрывать такие';
export const HIDE_QUESTION = 'Скрывать такие сообщения?';
export const hideInfo = (others: number) => `${others ? `Это сообщение и похожие на него (сейчас ещё ${others}) удалятся` : 'Это сообщение удалится'}, новые такие — тоже, без показа. Операций из них не будет.\n\nЕсли так скроется настоящая покупка, она не попадёт ни в траты, ни в план. Перестать скрывать: Настройки → «Шаблоны сообщений».`;
export const HIDE = 'Скрывать';

export const RESET = 'Сбросить все шаблоны';
export const RESET_QUESTION = 'Сбросить все шаблоны?';
export const RESET_INFO = 'Свои правила разбора и скрытия удалятся, сообщения снова будут попадать в «Не распознано». Созданные операции останутся.';
export const TEMPLATES_HINT = 'Свои правила разбора, из отмеченных вами сообщений. Работают после встроенного разбора TBC.';
export const DELETE_INFO = 'Удаление шаблона не трогает уже созданные операции; новые такие сообщения снова попадут в «Не распознано».';

/** "Отметьте сумму, валюту и мерчанта" */
export function missingText(missing: string[]): string {
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} и ${missing[missing.length - 1]}` : missing[0];
  return `Отметьте ${list}`;
}
