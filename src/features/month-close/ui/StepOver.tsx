import React from 'react';
import { Text, View } from 'react-native';
import type { CloseAnswers, MonthClose, OverCover, OverRestCover } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import Choice from './Choice';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void };

/** "🔒 300 → 200 · копилки −50 ₾ · прошлые сбережения −20 ₾": what "Из сбережений" takes. */
export function coverNote(b: NonNullable<MonthClose['budget']>, money: (minor: number) => string): string {
  return [
    b.cover.locked > 0 ? `🔒 ${money(b.locked_minor)} → ${money(b.locked_minor - b.cover.locked)}` : '',
    b.cover.funds > 0 ? `копилки −${money(b.cover.funds)}` : '',
    b.cover.past > 0 ? `прошлые сбережения −${money(b.cover.past)}` : '',
  ].filter(Boolean).join(' · ');
}

/**
 * Step "Перерасход": spending went past the budget less 🔒 — what covers it: "Из сбережений сентября" (🔒 first, then
 * the funds' contributions, the farthest due first, then the savings from before), "Из бюджета октября" (owed, red in
 * October's plan; not offered once October is over too), "Уже покрыт". A month closed before: 🔒 alone, what it
 * doesn't cover asked apart.
 */
export default function StepOver({ c, onAnswer }: Props) {
  const b = c.budget!;
  const money = (minor: number) => formatWithCurrency(minor, b.currency);
  const m = monthWords(c.ym);
  const next = monthWords(c.next_ym);
  const carry = c.can_carry || c.answers.over_cover === 'next' || c.answers.over_rest_cover === 'next';
  // a month closed before: 🔒 alone covered it
  const partial = b.over_rest_minor > 0;
  const covered = { value: 'covered' as const, title: 'Уже покрыт', note: 'со стороны — только в «Истории»' };
  const options: Array<{ value: OverCover; title: string; note: string }> = [
    {
      value: 'savings',
      title: partial ? `Из сбережений ${m.gen} — ${money(b.locked_minor)} из ${money(b.over_minor)}` : `Из сбережений ${m.gen}`,
      note: partial ? `🔒 ${money(b.locked_minor)} → 0: больше сбережений в ${m.prep} нет` : coverNote(b, money),
    },
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
