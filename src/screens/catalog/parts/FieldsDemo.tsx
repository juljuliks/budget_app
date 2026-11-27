import React, { useState } from 'react';
import type { Currency } from '@/db/fx';
import { dayTitle } from '@/shared/lib/dates';
import { dayKeyOf } from '@/shared/lib/dateRange';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import DateField from '@/shared/ui/DateField';
import SearchBar from '@/shared/ui/SearchBar';
import SelectField from '@/shared/ui/SelectField';
import TextField from '@/shared/ui/TextField';
import Frame from './Frame';

const noop = () => {};

/** Typing and picking a value: text and amount fields, search, a field opening a sheet, a date. */
export default function FieldsDemo() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('GEL');
  const [part, setPart] = useState('120');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<string | null>(dayKeyOf(new Date()));
  const [until, setUntil] = useState<string | null>(null);
  return (
    <>
      <Frame name="TextField" note="поле формы: подпись, подсказка или ошибка под ним; рамка в акценте, пока вводят">
        <TextField
          label="Название"
          value={name}
          onChangeText={setName}
          placeholder="Например, Netflix"
          hint="До 40 символов"
        />
        <TextField label="Описание" value="" placeholder="Например, рынок" error="Введите название" />
      </Frame>
      <Frame
        name="TextField amount"
        note="сумма: large + CurrencyButton справа (шиты); suffix ₾ внутри, compact в строке"
      >
        <TextField
          label="Сумма"
          amount
          large
          value={amount}
          onChangeText={setAmount}
          right={<CurrencyButton value={currency} onChange={setCurrency} />}
        />
        <TextField amount compact value={part} onChangeText={setPart} suffix="₾" accessibilityLabel="Часть" />
      </Frame>
      <Frame name="SearchBar · SelectField" note="поиск; поле выбора (открывает шит)">
        <SearchBar value={query} onChange={setQuery} placeholder="Поиск: мерчант, описание, сумма…" />
        <SelectField value="🛒 Продукты" onPress={noop} accessibilityLabel="Категория" />
        <SelectField value="Нельзя выбрать" onPress={noop} accessibilityLabel="Неактивно" disabled />
      </Frame>
      <Frame name="DateField" note="день: «Изменить» открывает календарь; необязательный — ещё «Убрать»">
        <DateField label="Дата" value={day} format={dayTitle} sheetTitle="Дата операции" onChange={setDay} />
        <DateField
          label="Дата окончания"
          value={until}
          format={dayTitle}
          sheetTitle="Дата окончания"
          onChange={setUntil}
          onClear={() => setUntil(null)}
        />
      </Frame>
    </>
  );
}
