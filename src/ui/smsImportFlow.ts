import { importInboxSms } from '../importer/inboxImport';
import { readBankSms, requestInboxAccess } from '../native/smsInbox';
import { plural } from './format';
import { sheetAlert } from './sheetAlert';

const PERIODS: Array<{ text: string; months: number | null }> = [
  { text: '1 месяц', months: 1 },
  { text: '3 месяца', months: 3 },
  { text: '6 месяцев', months: 6 },
  { text: 'Всё время', months: null },
];

/** "Импорт SMS" (Настройки): pick a period, allow reading SMS, then the bank's past SMS become transactions. */
export function startSmsImport() {
  sheetAlert(
    'Импорт SMS из телефона',
    'Транзакции из SMS банка, которые уже есть в телефоне. Уже добавленные не задвоятся. Понадобится разрешение на чтение SMS — читаются только сообщения банка.',
    [
      ...PERIODS.map((p) => ({ text: p.text, onPress: () => { run(p.months).catch((e) => fail(e)); } })),
      { text: 'Отмена', style: 'cancel' as const },
    ],
  );
}

async function run(months: number | null) {
  if (!(await requestInboxAccess())) {
    sheetAlert('Нет доступа к SMS', 'Без разрешения на чтение SMS импорт невозможен. Его можно дать в настройках Android → Приложения → Budget → Разрешения → SMS.');
    return;
  }
  const since = months === null ? 0 : (() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.getTime(); })();
  const messages = await readBankSms(since);
  if (messages.length === 0) {
    sheetAlert('SMS банка не найдены', 'За этот период в телефоне нет SMS от TBC.');
    return;
  }
  const r = await importInboxSms(messages);
  sheetAlert(
    r.inserted > 0 ? `Добавлено ${r.inserted} ${plural(r.inserted, ['транзакция', 'транзакции', 'транзакций'])}` : 'Новых транзакций нет',
    [
      `Прочитано SMS банка: ${messages.length}.`,
      r.duplicate ? `Уже были в приложении: ${r.duplicate}.` : '',
      r.ignored ? `Не транзакции (баланс, коды, отклонённые) или не распознаны: ${r.ignored}.` : '',
    ].filter(Boolean).join('\n'),
  );
}

function fail(e: unknown) {
  console.error('sms import failed', e);
  sheetAlert('Импорт не удался', String((e as Error)?.message ?? e));
}
