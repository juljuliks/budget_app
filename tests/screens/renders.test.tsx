// D1 (REFACTOR_PLAN.md): how many renders the key screens make on an action — «Операции» scrolled and selecting,
// «Статистика» switching its tab, the budget's sheet while typing. The numbers at the start of the refactor are in
// docs/refactor/renders-before.txt (RENDERS_OUT=<file> writes them); stage 6 turns them into thresholds.
import fs from 'fs';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { countRenders, longPress, openApp, openBudget, Renders, screen, scrollTo, tap } from './app';
import { base, ops } from '../e2e/seeds';

const measured: [string, Renders][] = [];

afterAll(() => {
  const out = process.env.RENDERS_OUT;
  if (!out) return;
  const lines = measured.flatMap(([name, r]) => [
    `${name}: ${r.total}`,
    ...r.top(12).map(([c, n]) => `  ${String(n).padStart(5)}  ${c}`),
  ]);
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
});

async function measure(name: string, action: () => unknown) {
  const r = await countRenders(action);
  measured.push([name, r]);
  return r;
}

test('«Операции»: scrolled down and up, then to the next page', async () => {
  await openApp(ops);
  await screen.findByText('SPAR');
  const at = (y: number) =>
    fireEvent.scroll(screen.getByTestId('operations-list'), {
      nativeEvent: {
        contentOffset: { y },
        contentSize: { height: 3000, width: 400 },
        layoutMeasurement: { height: 800, width: 400 },
      },
    });
  // «＋» hides on the way down and comes back on the way up: nothing else changes
  await measure('Операции — прокрутка вниз и вверх', async () => {
    at(300);
    await waitFor(() => expect(screen.queryByLabelText('Добавить операцию')).toBeNull());
    at(100);
    await screen.findByLabelText('Добавить операцию');
  });
  const r = await measure('Операции — вторая страница', () => scrollTo('operations-list', 'OLDSHOP'));
  expect(r.of('TransactionItem')).toBeGreaterThan(0);
});

test('«Операции»: selecting', async () => {
  await openApp(ops);
  await screen.findByText('SPAR');
  const r = await measure('Операции — выбор: зажать SPAR, тап WOLT', async () => {
    await longPress('SPAR');
    await screen.findByText('Выбрано: 1');
    await tap('WOLT');
    await screen.findByText('Выбрано: 2');
  });
  expect(r.total).toBeGreaterThan(0);
});

test('«Статистика»: «План», then «Траты»', async () => {
  await openApp(base);
  await tap('Статистика');
  await screen.findByLabelText('Добавить в план');
  const r = await measure('Статистика — вкладки «План» и «Траты»', async () => {
    await tap('План');
    await tap('Траты');
    await screen.findByLabelText('Добавить в план');
  });
  expect(r.total).toBeGreaterThan(0);
});

test("the budget's sheet: typing 3000", async () => {
  await openApp(base);
  await tap('Статистика');
  await screen.findByLabelText('Добавить в план');
  await openBudget();
  const input = screen.getByPlaceholderText('0');
  const r = await measure('Бюджет месяца — ввод 3000 по цифре', async () => {
    for (const t of ['3', '30', '300', '3000']) fireEvent.changeText(input, t);
    await screen.findByDisplayValue('3000');
  });
  expect(r.total).toBeGreaterThan(0);
});
