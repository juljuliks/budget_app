import React from 'react';
import { Text, View } from 'react-native';
import type { CloseAnswers, MonthClose, OverCover, OverRestCover } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import Choice from './Choice';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void };

/**
 * Step "Перерасход": spending went past the budget less 🔒 — what covers it: "Из сбережений сентября" (🔒 less it; not
 * offered without 🔒), "Из бюджета октября" (owed, red in October's plan; not offered once October is over too),
 * "Уже покрыт". 🔒 smaller than it: what 🔒 doesn't cover, asked apart.
 */
export default function StepOver({ c, onAnswer }: Props) {
  const b = c.budget!;
  const money = (minor: number) => formatWithCurrency(minor, b.currency);
  const m = monthWords(c.ym);
  const next = monthWords(c.next_ym);
  const carry = c.can_carry || c.answers.over_cover === 'next' || c.answers.over_rest_cover === 'next';
  const partial = b.locked_minor > 0 && b.locked_minor < b.over_minor;
  const covered = { value: 'covered' as const, title: 'Уже покрыт', note: 'из прошлых сбережений или со стороны — только в «Истории»' };
  const options: Array<{ value: OverCover; title: string; note: string }> = [
    ...(b.locked_minor > 0 ? [{
      value: 'savings' as const,
      title: partial ? `Из сбережений ${m.gen} — ${money(b.locked_minor)} из ${money(b.over_minor)}` : `Из сбережений ${m.gen}`,
      note: partial ? `🔒 ${money(b.locked_minor)} → 0: больше сбережений в ${m.prep} нет`
        : `🔒 ${money(b.locked_minor)} → ${money(b.locked_minor - b.over_minor)} — отложено меньше`,
    }] : []),
    ...(carry ? [{ value: 'next' as const, title: `Из бюджета ${next.gen}${partial ? ` — все ${money(b.over_minor)}` : ''}`, note: `вычтем из бюджета ${next.gen} — красным в плане` }] : []),
    covered,
  ];
  const rest: Array<{ value: OverRestCover; title: string; note: string }> = [
    ...(carry ? [{ value: 'next' as const, title: `Из бюджета ${next.gen}`, note: `вычтем из бюджета ${next.gen} — красным в плане` }] : []),
    { ...covered, note: 'только в «Истории»' },
  ];
  const spentFor = b.amount_minor - b.locked_minor;
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.headText}>Перерасход бюджета</Text>
        <Text style={[styles.headText, styles.headOver]}>{money(b.over_minor)}</Text>
      </View>
      <Text style={styles.muted}>
        {b.locked_minor > 0 ? `Потрачено ${money(b.spent_minor)}, а на траты было ${money(spentFor)} — бюджет без «🔒 Отложено сразу»`
          : `Потрачено ${money(b.spent_minor)} при бюджете ${money(b.amount_minor)}`}
      </Text>
      <Text style={styles.question}>Чем покрыть?</Text>
      <Choice options={options} value={c.answers.over_cover} onChange={(v) => onAnswer({ over_cover: v })} />
      {b.over_rest_minor > 0 ? (
        <>
          <Text style={styles.question}>{`Остальные ${money(b.over_rest_minor)}?`}</Text>
          <Choice options={rest} value={c.answers.over_rest_cover} onChange={(v) => onAnswer({ over_rest_cover: v })} />
        </>
      ) : null}
    </View>
  );
}
