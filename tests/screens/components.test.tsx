import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Banner from '@/shared/ui/Banner';
import Empty from '@/shared/ui/Empty';
import ModeBanner from '@/shared/ui/ModeBanner';

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
