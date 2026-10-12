// 1.7: bank messages no operation came from — "Не распознано", marking one, the template made of it ("Шаблоны
// сообщений"), hiding such ones. Today: Thursday 15 October 2026 12:00 (setup.ts).
import { act, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts } from './app';
import { getDb } from '../../src/db';
import { ingestSms } from '../../src/ingest/ingest';
import { listTemplates, listUnparsed } from '../../src/db/messages';
import { navigationRef } from '../../src/shared/navigation/navigation';

const PUSH = (amount: string, cur: string, merchant: string, day: string) =>
  `TBC Bank\nPayment · ${amount} ${cur}, ${merchant}, ${day}.10.2026 10:00. Card *1234. Balance: 2 843.17 GEL`;
const push = (body: string, minutesAgo = 0) =>
  act(async () => { await ingestSms({ sender: 'push:ge.tbcbank', body, timestamp: Date.now() - minutesAgo * 60000, source: 'push' }); });
const ops = async () => (await getDb()).all<{ m: string; a: number; c: string; kind: string }>(
  'SELECT raw_merchant AS m, amount_minor AS a, currency AS c, kind FROM transactions WHERE source = \'push\' ORDER BY occurred_at');

/** The app with two pushes nothing read and an offer, "Не распознано" opened, the first push to mark */
async function openFabrika() {
  await openApp();
  await push(PUSH('12.50', 'USD', 'WOLT GEORGIA', '14'), 60);
  await push('TBC Bank\nNew offer: cashback 5%', 30);
  await push(PUSH('45.00', 'GEL', 'FABRIKA', '15'));
  await tap('Не распознано: 3');
  expect(await screen.findByText('Сообщения банка, из которых не получилась операция. Отметьте в тексте сумму и валюту — такие будут разбираться сами. Хранятся 30 дней.')).toBeTruthy();
  await tap(/FABRIKA/);
  await screen.findByText('1 · Выберите, что отмечаете');
}

/** marks words with a role */
async function mark(role: string, ...words: string[]) {
  await tap(role);
  for (const w of words) await tap(w);
}

test('1.7.1: a push nothing read: "Не распознано: N" over the operations, its list, its words to mark', async () => {
  await openFabrika();
  // the words: no punctuation, each once ("GEL" twice in the text), "2 843.17" one
  const t = texts();
  const from = t.indexOf('2 · Нажмите на слова в тексте');
  expect(t.slice(from + 1, from + 13)).toEqual(['TBC', 'Bank', 'Payment', '45.00', 'GEL', 'FABRIKA', '15.10.2026', '10:00', 'Card', '1234', 'Balance', '2 843.17']);
  expect(screen.getByText('Отметьте сумму и валюту')).toBeTruthy();
});

test('1.7.2: marked → the result as a row of the list; the template takes the kept ones like it, then new ones', async () => {
  await openFabrika();
  await mark('Сумма', '45.00');
  expect(screen.getByText('Отметьте валюту')).toBeTruthy();
  await mark('Валюта', 'GEL');
  await mark('Мерчант', 'FABRIKA');
  await mark('Дата и время', '15.10.2026', '10:00');
  await mark('Баланс', '2 843.17');
  expect(await screen.findByText('−45.00 ₾')).toBeTruthy();
  expect(screen.getByText(' · Сегодня, 10:00')).toBeTruthy();
  await tap('Дальше: к каким подойдёт');
  expect(await screen.findByText('Подойдёт к 2 сообщениям')).toBeTruthy();
  expect(screen.getByText('WOLT GEORGIA')).toBeTruthy();
  await tap('Сохранить и разобрать 2');
  expect(await screen.findByText('Шаблон сохранён, разобрано: 2')).toBeTruthy();
  expect(await ops()).toEqual([{ m: 'WOLT GEORGIA', a: 1250, c: 'USD', kind: 'purchase' }, { m: 'FABRIKA', a: 4500, c: 'GEL', kind: 'purchase' }]);
  expect((await listUnparsed()).map((m) => m.body)).toEqual(['TBC Bank\nNew offer: cashback 5%']);
  // a new push like it: an operation right away
  await push(PUSH('7.00', 'GEL', 'SPAR', '15'));
  await waitFor(async () => expect((await ops()).map((o) => o.m)).toContain('SPAR'));
});

test('1.7.3: "Создать только эту операцию": of its type, no template', async () => {
  await openFabrika();
  await mark('Сумма', '45.00');
  await mark('Валюта', 'GEL');
  await mark('Мерчант', 'FABRIKA');
  await tap('Снятие наличных');
  expect(await screen.findByText('Снятие наличных · FABRIKA')).toBeTruthy();
  await tap('Создать только эту операцию');
  expect(await screen.findByText('Операция добавлена')).toBeTruthy();
  expect(await ops()).toEqual([{ m: 'FABRIKA', a: 4500, c: 'GEL', kind: 'withdrawal' }]);
  expect(await listTemplates()).toEqual([]);
  expect(await listUnparsed()).toHaveLength(2);
});

test('1.7.4: "Не операция — скрывать такие": asked first; such ones go, new ones too', async () => {
  await openApp();
  await push('TBC Bank\nYour one-time code is 123456', 10);
  await push('TBC Bank\nYour one-time code is 777777');
  await tap('Не распознано: 2');
  await tap('TBC Bank\nYour one-time code is 777777');
  await tap('Не операция — скрывать такие');
  expect(await screen.findByText('Скрывать такие сообщения?')).toBeTruthy();
  expect(screen.getByText(/^Это сообщение и похожие на него \(сейчас ещё 1\) удалятся/)).toBeTruthy();
  await tap('Скрывать');
  expect(await screen.findByText('Скрыто сообщений: 2')).toBeTruthy();
  expect(await listUnparsed()).toEqual([]);
  await push('TBC Bank\nYour one-time code is 555555');
  expect(await listUnparsed()).toEqual([]);
});

test('1.7.5: Настройки → «Шаблоны сообщений»: each with its example and count; reset all, asked first', async () => {
  await openApp();
  await push('TBC Bank\nYour one-time code is 123456');
  await tap('Не распознано: 1');
  await tap('TBC Bank\nYour one-time code is 123456');
  await tap('Не операция — скрывать такие');
  await tap('Скрывать');
  await screen.findByText('Скрыто сообщений: 1');
  // back from "Не распознано" to the operations
  expect(await screen.findByText('Всё разобрано.')).toBeTruthy();
  act(() => navigationRef.goBack());
  await tap('Настройки');
  await tap('Шаблоны сообщений');
  expect(await screen.findByText('Не операция · Уведомление TBC')).toBeTruthy();
  expect(screen.getByText('Скрыто: 1 · последнее — сегодня')).toBeTruthy();
  await tap('Сбросить все шаблоны');
  expect(await screen.findByText('Сбросить все шаблоны?')).toBeTruthy();
  await tap('Сбросить все шаблоны');
  expect(await screen.findByText('Шаблоны сброшены')).toBeTruthy();
  expect(await listTemplates()).toEqual([]);
  expect(await screen.findByText('Шаблонов пока нет: они появляются из «Не распознано» в «Операциях».')).toBeTruthy();
});
