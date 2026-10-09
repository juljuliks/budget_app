// 1.2, 1.5, 1.6: the card's balance, a manual operation, SMS arriving while the list is open (the same ingestSms the
// background task runs).
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
import { ops } from '../e2e/seeds';
import { ingestSms } from '../../src/ingest';
import { getDb } from '../../src/db';
import { dayKeyOf } from '../../src/shared/lib/dateRange';
import { topUpCategoryId } from '../../src/db/categories';

const p2 = (n: number) => String(n).padStart(2, '0');
/** "dd/mm/yyyy hh:mm", minutes ago */
const when = (min = 0) => { const d = new Date(Date.now() - min * 60000); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const sms = (body: string) => act(async () => { await ingestSms({ sender: 'TBC', body, timestamp: Date.now() }); });

describe('1.2 the card\'s balance', () => {
  test('none yet', async () => {
    await openApp();
    expect(await screen.findByText('Появится после следующего SMS от банка с балансом (например, о покупке)')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
  test('from a purchase SMS; what it is', async () => {
    await openApp();
    await sms(`44.00GEL\n(*1234)\nSPAR\n${when(5)}\nBalance: 283.14GEL`);
    expect(await screen.findByText('283.14 ₾')).toBeTruthy();
    expect(screen.getByText(/^по SMS сегодня \d\d:\d\d$/)).toBeTruthy();
    await tap('283.14 ₾');
    expect(await screen.findByText('Баланс, который банк прислал в последнем SMS.')).toBeTruthy();
  });
  test('operations after it are added; the latest SMS by time wins', async () => {
    await openApp();
    await sms(`10.00GEL\n(*1234)\nSPAR\n${when(60)}\nBalance: 300.00GEL`);
    await sms(`20.00GEL\n(*1234)\nGLOVO\n${when(120)}\nBalance: 250.00GEL`);
    await sms(`Deposit Money: 100.00 GEL\nMC GOLD\n${when(0).slice(0, 10)}\nANA K`);
    await sms('A refund of 5.00 GEL has been initiated by SPAR to your MC GOLD (*1234).');
    expect(await screen.findByText('≈ 400.00 ₾')).toBeTruthy();
    expect(screen.getByText(/^≈ по SMS сегодня \d\d:\d\d \+ 1 операция после$/)).toBeTruthy();
    await tap('≈ 400.00 ₾');
    expect(await screen.findByText(/^Баланс из последнего SMS банка плюс операции после него/)).toBeTruthy();
  });
});

describe('1.5 a manual operation', () => {
  beforeEach(() => openApp(ops));
  const open = async () => { await tap('Добавить операцию'); return screen.findByText('Новая операция'); };

  test('the form', async () => {
    await open();
    for (const t of ['Расход', 'Пополнение', 'Сумма', 'Описание (необязательно)', 'Изменить', 'Добавить', 'Отмена']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText(/^Сегодня, \d+ [а-я]+$/)).toBeTruthy();
    expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
    expect(screen.getByPlaceholderText('Например, рынок')).toBeTruthy();
  });
  test('the amount\'s checks', async () => {
    await open();
    await tap('Добавить');
    expect(await screen.findByText('⚠️  Введите сумму')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '1.234');
    await tap('Добавить');
    expect(await screen.findByText('⚠️  Введите сумму, например 1500 или 12.50')).toBeTruthy();
    expect(screen.getByText('Новая операция')).toBeTruthy();
  });
  test('a purchase with a category: in the list, seen, the time now', async () => {
    await open();
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '12,5');
    fireEvent.changeText(screen.getByPlaceholderText('Например, рынок'), 'Рынок');
    await tap('🛒 Продукты');
    await tap('Добавить');
    expect(await screen.findByText('Операция добавлена')).toBeTruthy();
    expect(await screen.findByText('Рынок')).toBeTruthy();
    const row = await (await getDb()).get<Record<string, unknown>>(
      "SELECT kind, amount_minor AS a, currency AS c, merchant_key AS k, category_source AS s, seen_at IS NOT NULL AS seen, occurred_at AS at FROM transactions WHERE raw_merchant = 'Рынок'");
    expect(row).toMatchObject({ kind: 'purchase', a: 1250, c: 'GEL', k: null, s: 'user', seen: 1 });
    expect(Math.abs(Date.now() / 1000 - (row!.at as number))).toBeLessThan(60);
  });
  test('a deposit yesterday, in dollars: in "Пополнение счёта"', async () => {
    await open();
    await tap('Пополнение');
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '100');
    await tap('Изменить дату');
    expect(await screen.findByText('Дата операции')).toBeTruthy();
    const y = new Date(Date.now() - 864e5);
    await tap(`#day-${dayKeyOf(y)}`);
    await tap('Выбрать');
    expect(await screen.findByText(/^Вчера, \d+ [а-я]+$/)).toBeTruthy();
    await tap('GEL');
    await tap('USD');
    await tap('Добавить');
    expect(await screen.findByText('Операция добавлена')).toBeTruthy();
    const row = await (await getDb()).get<{ kind: string; c: string; cat: number | null; at: number }>(
      "SELECT kind, currency AS c, category_id AS cat, occurred_at AS at FROM transactions WHERE amount_minor = 10000 AND kind = 'deposit' AND bank = 'manual'");
    // a deposit: "Пополнение счёта" unless another is picked
    expect(row).toMatchObject({ kind: 'deposit', c: 'USD', cat: await topUpCategoryId() });
    expect(dayKeyOf(new Date(row!.at * 1000))).toBe(dayKeyOf(y));
  });
  test('days after today can\'t be picked; the form is clean next time', async () => {
    await open();
    await tap('Изменить дату');
    const tomorrow = dayKeyOf(new Date(Date.now() + 864e5));
    if (tomorrow.slice(0, 7) === dayKeyOf(new Date()).slice(0, 7)) {
      expect(screen.getByTestId(`day-${tomorrow}`).props.accessibilityState?.disabled ?? screen.getByTestId(`day-${tomorrow}`).props.disabled).toBeTruthy();
    }
    await tap('Отмена');
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '5');
    await tap('Отмена');
    await open();
    expect(screen.getByPlaceholderText('0.00').props.value).toBe('');
  });
});

describe('1.6 an SMS while the list is open', () => {
  test('it shows at once, with its merchant\'s category and "🤖 авто"; the badge counts the ones without', async () => {
    await openApp(ops);
    await screen.findByText('SPAR');
    await sms(`12.00GEL\n(*1234)\nMARKET\n${when(1)}`);
    await sms(`8.00GEL\n(*1234)\nNEWSHOP\n${when(0)}`);
    expect(await screen.findByText('NEWSHOP')).toBeTruthy();
    expect(screen.getByText('🤖 авто')).toBeTruthy();
    // the transfer, GLOVO and NEWSHOP
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
  });
});
