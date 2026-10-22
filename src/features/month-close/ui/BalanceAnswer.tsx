import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { CloseAnswers, MonthClose } from '@/db/plans';
import { currencySymbol, formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import { monthBeforePrep, monthWords } from '../model/closeTexts';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void };

function MoneyField({ minor, label, currency, onCommit }: {
  minor: number | null; label: string; currency: string; onCommit: (minor: number) => void;
}) {
  const [text, setText] = useState(toInputValue(minor));
  const textRef = useRef(text);
  const [focus, setFocus] = useState(false);
  useEffect(() => { textRef.current = toInputValue(minor); setText(textRef.current); }, [minor]);
  return (
    <View style={[styles.field, focus && styles.fieldOn]}>
      <TextInput
        style={styles.input} value={text} keyboardType="decimal-pad"
        accessibilityLabel={label}
        onChangeText={(v) => { textRef.current = v; setText(v); }}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          const n = parseAmountOrZero(textRef.current);
          if (n !== null) onCommit(n);
        }}
      />
      <Text style={styles.cur}>{currencySymbol(currency)}</Text>
    </View>
  );
}

/**
 * "Остаток": one field, in the budget's currency, opening on the month before's balance plus what the budget would
 * save. No previous balance — "В августе было" once. Under the field: the calculation, the month's change, and how far
 * the account is from the calculation.
 */
export default function BalanceAnswer({ c, onAnswer }: Props) {
  const money = (n: number) => formatWithCurrency(n, c.currency);
  const signed = (n: number) => (n > 0 ? `+${money(n)}` : money(n));
  const b = c.balance;
  const was = `В ${monthBeforePrep(c.ym)} было`;
  const commitOpen = (minor: number) => {
    const followed = b.value === null || (b.open !== null && b.value === b.open + c.ask_minor);
    const value = followed ? minor + c.ask_minor : b.value ?? minor;
    onAnswer({ by_balance: 1, balance_open_minor: minor, balance_minor: value, saved: 'other', saved_minor: value - minor });
  };
  const commitBalance = (minor: number) => {
    const base = b.prior ?? b.open;
    if (base === null) return;
    onAnswer({ by_balance: 1, balance_minor: minor, saved: 'other', saved_minor: minor - base });
  };
  return (
    <View style={styles.stack}>
      {b.prior === null ? (
        <>
          {b.open === null ? <Text style={styles.calc}>Прошлого остатка нет — его нужно ввести один раз.</Text> : null}
          <Text style={styles.fieldLabel}>{was}</Text>
          <MoneyField minor={b.open} label={was} currency={c.currency} onCommit={commitOpen} />
        </>
      ) : null}
      {b.suggested !== null ? (
        <>
          <MoneyField minor={b.value} label="Остаток на счёте" currency={c.currency} onCommit={commitBalance} />
          <Text style={styles.calc}>
            {`${was} ${money(b.prior ?? b.open ?? 0)}, по бюджету ${signed(c.ask_minor)} — по расчёту ${money(b.suggested)}.`}
          </Text>
          {b.delta !== null ? (
            <Text style={[styles.delta, b.delta < 0 && styles.down]}>{`За ${monthWords(c.ym).nom} ${signed(b.delta)}`}</Text>
          ) : null}
          {b.short !== null && b.short !== 0 ? (
            <Text style={[styles.gapNote, b.short > 0 ? styles.down : styles.headSaved]}>
              {b.short > 0 ? `На ${money(b.short)} меньше расчёта` : `На ${money(-b.short)} больше расчёта`}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
