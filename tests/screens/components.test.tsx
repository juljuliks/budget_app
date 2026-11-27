import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AmountRow from '@/shared/ui/AmountRow';
import Banner from '@/shared/ui/Banner';
import Empty from '@/shared/ui/Empty';
import ModeBanner from '@/shared/ui/ModeBanner';
import TextField from '@/shared/ui/TextField';
import { base } from '../e2e/seeds';
import { openApp, openMenu } from './app';

// shared/ui on its own: what each prop shows and does (one look for every copy, stage 4 of REFACTOR_PLAN.md)
describe('Banner', () => {
  test('title, text, children; ✕ by its label; an alert is read out', () => {
    const close = jest.fn();
    render(
      <Banner
        title="Октябрь не закрыт"
        text="Подведите итоги"
        alert
        close={{ label: 'Скрыть до завтра', onPress: close }}
      >
        <></>
      </Banner>,
    );
    expect(screen.getByText('Октябрь не закрыт')).toBeTruthy();
    expect(screen.getByText('Подведите итоги')).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Скрыть до завтра'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('onPress: the whole banner is a button with ›', () => {
    const press = jest.fn();
    render(<Banner title="Не распознано: 2" onPress={press} />);
    expect(screen.getByText('›')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(press).toHaveBeenCalledTimes(1);
  });

  test('ModeBanner: the text and "Отменить" by testID', () => {
    const cancel = jest.fn();
    render(<ModeBanner text="Удаление «Такси»" onCancel={cancel} testID="sort-out" />);
    expect(screen.getByTestId('sort-out-banner')).toBeTruthy();
    expect(screen.getByText('Удаление «Такси»')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sort-out-cancel'));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('Empty', () => {
  test('the text, in every variant', () => {
    render(
      <>
        <Empty>Не найдено.</Empty>
        <Empty compact>Пока пусто</Empty>
        <Empty inline>Изменений нет</Empty>
      </>,
    );
    expect(screen.getByText('Не найдено.')).toBeTruthy();
    expect(screen.getByText('Пока пусто')).toBeTruthy();
    expect(screen.getByText('Изменений нет')).toBeTruthy();
  });
});

describe('TextField', () => {
  test('its label, a hint — or an error instead; an amount: the decimal keyboard, "0.00", the symbol inside', () => {
    const typed = jest.fn();
    const { rerender } = render(
      <TextField
        label="Название"
        value=""
        onChangeText={typed}
        placeholder="Например, Netflix"
        hint="До 40 символов"
      />,
    );
    expect(screen.getByText('Название')).toBeTruthy();
    expect(screen.getByText('До 40 символов')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Например, Netflix'), 'Spotify');
    expect(typed).toHaveBeenCalledWith('Spotify');
    rerender(<TextField label="Название" value="" hint="До 40 символов" error="Введите название" />);
    expect(screen.getByText('Введите название')).toBeTruthy();
    expect(screen.queryByText('До 40 символов')).toBeNull();
    rerender(<TextField amount value="" suffix="₾" accessibilityLabel="Сумма" />);
    const field = screen.getByLabelText('Сумма');
    expect(field.props.keyboardType).toBe('decimal-pad');
    expect(field.props.placeholder).toBe('0.00');
    expect(screen.getByText('₾')).toBeTruthy();
  });
});

describe('AmountRow', () => {
  test('its name, notes and amount; a tap by its label', () => {
    const open = jest.fn();
    render(
      <AmountRow
        title="📺 Подписки"
        notes={<Text>каждый месяц</Text>}
        amount={<Text>70 ₾</Text>}
        onPress={open}
        accessibilityLabel="Подписки"
      />,
    );
    expect(screen.getByText('📺 Подписки')).toBeTruthy();
    expect(screen.getByText('каждый месяц')).toBeTruthy();
    expect(screen.getByText('70 ₾')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Подписки'));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('«Компоненты» (debug build only)', () => {
  test('⋮ › Компоненты: every frame of the catalog is drawn', async () => {
    await openApp(base);
    await openMenu('Компоненты');
    for (const name of [
      'Button',
      'Chip',
      'RadioGroup',
      'SwitchRow',
      'TextField',
      'TextField amount',
      'DateField',
      'RangeCalendar',
      'Fab',
      'AmountRow',
      'Banner',
      'Empty',
      'Loading',
      'Meter',
      'Donut',
    ])
      expect(screen.getByTestId(`catalog-${name}`)).toBeTruthy();
  });
});
