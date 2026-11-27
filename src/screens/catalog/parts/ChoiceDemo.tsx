import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { UNTYPED_COLORS } from '@/domain/colors';
import Checkbox from '@/shared/ui/Checkbox';
import ColorSwatches from '@/shared/ui/ColorSwatches';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import RadioGroup from '@/shared/ui/RadioGroup';
import SearchBar from '@/shared/ui/SearchBar';
import Segmented from '@/shared/ui/Segmented';
import SelectField from '@/shared/ui/SelectField';
import StepSlider from '@/shared/ui/StepSlider';
import SwitchRow from '@/shared/ui/SwitchRow';
import Toggle from '@/shared/ui/Toggle';
import { space } from '@/shared/theme/tokens';
import Frame from './Frame';

const noop = () => {};

/** Choosing and typing: radio, tabs, switches, fields. */
export default function ChoiceDemo() {
  const [radio, setRadio] = useState<'month' | 'week'>('month');
  const [tab, setTab] = useState<'spent' | 'plan'>('spent');
  const [on, setOn] = useState(true);
  const [step, setStep] = useState(10);
  const [color, setColor] = useState<string | null>(UNTYPED_COLORS[0] ?? null);
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState<Currency>('GEL');
  return (
    <>
      <Frame name="RadioGroup" note="один из нескольких, с подсказкой под вариантом">
        <RadioGroup
          options={[
            ['month', 'На месяц', 'сумма плана'],
            ['week', 'Лимит на неделю'],
          ]}
          value={radio}
          onChange={setRadio}
        />
      </Frame>
      <Frame name="Segmented" note="вкладки внутри экрана; disabled — недоступная">
        <Segmented
          options={[
            ['spent', 'Траты'],
            ['plan', 'План'],
          ]}
          value={tab}
          onChange={setTab}
        />
      </Frame>
      <Frame name="Checkbox · Toggle" note="отметка в строке выбора; переключатель">
        <View style={styles.row}>
          <Checkbox checked={false} />
          <Checkbox checked />
          <Toggle label="Включено" value={on} onChange={setOn} />
          <Toggle label="Неактивен" value={false} onChange={noop} disabled />
        </View>
      </Frame>
      <Frame name="SwitchRow" note="настройка с переключателем, состояние строкой, ссылка «изменить»">
        <SwitchRow
          label="Автокопия"
          hint={on ? 'Каждый день в Загрузки' : 'Выключена'}
          on={on}
          onChange={setOn}
          change={{ title: 'Сменить папку', onPress: noop }}
        />
      </Frame>
      <Frame name="StepSlider" note="значение из шагов: процент, день">
        <StepSlider values={[0, 5, 10, 15, 20, 30]} value={step} onChange={setStep} label={(v) => `${v}%`} />
      </Frame>
      <Frame name="ColorSwatches" note="цвет категории: палитра, авто, свой">
        <ColorSwatches options={UNTYPED_COLORS} value={color} onChange={setColor} onCustom={noop} />
      </Frame>
      <Frame name="SearchBar · SelectField · CurrencyButton" note="поиск; поле выбора (открывает шит); валюта">
        <SearchBar value={query} onChange={setQuery} placeholder="Поиск: мерчант, описание, сумма…" />
        <SelectField value="🛒 Продукты" onPress={noop} accessibilityLabel="Категория" />
        <SelectField value="Нельзя выбрать" onPress={noop} accessibilityLabel="Неактивно" disabled />
        <CurrencyButton value={currency} onChange={setCurrency} />
      </Frame>
    </>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: space[16] } });
