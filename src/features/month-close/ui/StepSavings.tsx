import React from 'react';
import { Text, View } from 'react-native';
import type { CloseAnswers, MonthClose, RestChoice } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import AmountAnswer from './AmountAnswer';
import Choice from './Choice';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void };

function Line({ label, value, tone }: { label: string; value: string; tone?: object }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineText}>{label}</Text>
      <Text style={[styles.lineValue, tone]}>{value}</Text>
    </View>
  );
}

/**
 * Step "Сбережения", in the budget's currency: where 🌊 "Что осталось" goes ("В сбережения" / "Перенести на октябрь" /
 * "Оставить как есть"), then "Удалось отложить?" on what goes to savings — 🔒 less the overspend it covered, and the
 * leftover if it goes there. Nothing goes there: not asked.
 */
export default function StepSavings({ c, onAnswer }: Props) {
  const b = c.budget!;
  const money = (minor: number) => formatWithCurrency(minor, b.currency);
  const m = monthWords(c.ym);
  const next = monthWords(c.next_ym);
  const options: Array<{ value: RestChoice; title: string; note: string }> = [
    { value: 'savings', title: 'В сбережения', note: b.locked_minor > 0 ? `в сбережения ${m.gen} вместе с 🔒 «Сразу»` : `в сбережения ${m.gen}` },
    ...(c.can_carry || c.answers.rest_choice === 'next'
      ? [{ value: 'next' as const, title: `Перенести на ${next.nom}`, note: `+${money(b.rest_minor)} к бюджету ${next.gen} — строкой «Перенос из ${m.gen}»` }]
      : []),
    { value: 'keep', title: 'Оставить как есть', note: 'в «Истории» — сэкономлено, никуда не относим' },
  ];
  const restToSavings = b.rest_minor > 0 && c.answers.rest_choice === 'savings';
  return (
    <>
      {b.rest_minor > 0 ? (
        <View style={styles.block}>
          <View style={styles.head}>
            <Text style={styles.headText}>🌊 Что осталось</Text>
            <Text style={styles.headText}>{money(b.rest_minor)}</Text>
          </View>
          <Text style={styles.muted}>{`Не запланировано и не потрачено в ${m.prep}`}</Text>
          <Text style={styles.question}>Куда остаток?</Text>
          <Choice options={options} value={c.answers.rest_choice} onChange={(v) => onAnswer({ rest_choice: v })} />
        </View>
      ) : null}
      {b.ask_minor > 0 ? (
        <View style={[styles.block, styles.savings]}>
          <View style={styles.head}>
            <Text style={styles.headText}>В сбережения</Text>
            <Text style={[styles.headText, styles.headSaved]}>{money(b.ask_minor)}</Text>
          </View>
          {b.locked_minor > 0 ? <Line label="🔒 Сразу" value={money(b.locked_minor)} /> : null}
          {b.from_savings_minor > 0 ? (
            <>
              <Line label="Перерасход съел" value={`−${money(b.from_savings_minor)}`} tone={styles.headOver} />
              <View style={styles.rule} />
              <Line label="Осталось в сбережениях" value={money(b.kept_locked_minor)} tone={styles.headSaved} />
            </>
          ) : null}
          {restToSavings ? <Line label="🌊 Что осталось" value={money(b.rest_minor)} /> : null}
          {b.moved_minor > 0 ? <Line label="Уже переведено в «🏦 Сбережения»" value={money(b.moved_minor)} /> : null}
          <Text style={styles.question}>Удалось отложить?</Text>
          <AmountAnswer asked={b.ask_minor} currency={b.currency} answered={c.saved_minor} label="Отложено в сбережения"
            onAnswer={(minor, kind) => onAnswer({ saved: kind, saved_minor: kind === 'other' ? minor : null })}
            onReset={() => onAnswer({ saved: null, saved_minor: null })} />
        </View>
      ) : null}
      {b.rest_minor === 0 && b.over_minor > 0 ? <Text style={styles.muted}>Остатка нет: бюджет потрачен целиком</Text> : null}
    </>
  );
}
