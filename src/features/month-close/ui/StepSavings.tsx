import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CloseAnswers, MonthClose } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import Segmented from '@/shared/ui/Segmented';
import { monthWords } from '../model/closeTexts';
import AmountAnswer from './AmountAnswer';
import BalanceAnswer from './BalanceAnswer';
import SplitRows from './SplitRows';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void; onSplit: () => void };

function Line({ label, value, tone }: { label: string; value: string; tone?: object }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineText}>{label}</Text>
      <Text style={[styles.lineValue, tone]}>{value}</Text>
    </View>
  );
}

/**
 * Step "Сбережения", in the budget's currency: what the budget left ("Бюджет сентября", "Потрачено", "Осталось от
 * бюджета"), then "За месяц" ("Сколько удалось отложить?": "Да, <осталось>" / "Другая сумма" / "Нет") or "Остаток"
 * (the account). How it is laid out — the funds' contributions, the nearest due first, 🔒 "Отложено сразу",
 * 💰 "Сэкономлено" (or moved to the next month); "Изменить распределение ›" — by hand.
 */
export default function StepSavings({ c, onAnswer, onSplit }: Props) {
  const b = c.budget;
  const money = (minor: number) => formatWithCurrency(minor, c.currency);
  const m = monthWords(c.ym);
  const left = b ? b.amount_minor - b.own_spent_minor : null;
  const head = c.balance.on && c.balance.delta !== null ? c.balance.delta : (c.put_minor ?? c.ask_minor);
  const pick = (mode: 'month' | 'balance') => {
    if (mode === 'month') {
      if (!c.balance.on) return;
      onAnswer({ by_balance: 0, balance_minor: null, balance_open_minor: null, saved: null, saved_minor: null });
      return;
    }
    if (c.balance.on) return;
    const value = c.balance.prior === null ? null : c.balance.prior + c.ask_minor;
    onAnswer({
      by_balance: 1, balance_open_minor: null, balance_minor: value,
      saved: value === null ? null : 'other', saved_minor: value === null ? null : c.ask_minor,
    });
  };
  return (
    <View style={[styles.block, styles.savings]}>
      <View style={styles.head}>
        <Text style={styles.headText}>Сбережения</Text>
        <Text style={[styles.headText, head < 0 ? styles.headOver : styles.headSaved]}>
          {c.balance.on && c.balance.delta !== null && head > 0 ? `+${money(head)}` : money(head)}
        </Text>
      </View>
      {b && left !== null ? (
        <>
          <Line label={`Бюджет ${m.gen}`} value={money(b.amount_minor)} />
          <Line label="Потрачено" value={`−${money(b.own_spent_minor)}`} />
          <View style={styles.rule} />
          <Line label="Осталось от бюджета" value={money(left)} tone={left < 0 ? styles.headOver : styles.headSaved} />
        </>
      ) : null}
      <Segmented options={[['month', 'За месяц'], ['balance', 'Остаток']]} value={c.balance.on ? 'balance' : 'month'} onChange={pick} />
      {c.balance.on ? <BalanceAnswer c={c} onAnswer={onAnswer} /> : (
        <>
          <Text style={styles.question}>Сколько удалось отложить?</Text>
          <AmountAnswer
            asked={c.ask_minor} currency={c.currency} answered={c.put_minor} label="Отложено"
            onAnswer={(minor, kind) => onAnswer({ saved: kind, saved_minor: kind === 'other' ? minor : null })}
            onReset={() => onAnswer({ saved: null, saved_minor: null })}
          />
        </>
      )}
      <Text style={styles.question}>{c.split ? 'Разложили' : 'Разложим так'}</Text>
      <SplitRows c={c} onAnswer={onAnswer} />
      {c.split && c.funds.length ? (
        <TouchableOpacity onPress={onSplit} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Изменить распределение ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
