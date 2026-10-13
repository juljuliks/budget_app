import React from 'react';
import { Text, View } from 'react-native';
import type { CloseFund, MonthClose } from '@/db/plans';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import AmountAnswer from './AmountAnswer';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (categoryId: number, minor: number | null) => void };

/** Under a fund's answer: what the contribution makes of it — reached, short by the due date, what didn't go in. */
function fundNote(f: CloseFund, c: MonthClose): string | null {
  const money = (minor: number) => formatWithCurrency(minor, f.currency);
  const label = `${f.emoji ?? ''} ${f.name}`.trim();
  if (f.confirmed_minor === null) {
    return `с этим взносом — ${money(f.with_planned_minor)} из ${money(f.target_minor)}${f.with_planned_minor >= f.target_minor ? ', накоплено' : ''}`;
  }
  const has = f.with_planned_minor - f.planned_minor + f.confirmed_minor;
  if (has >= f.target_minor) return `${label} накоплена — ${money(has)}`;
  const missed = f.planned_minor - f.confirmed_minor;
  const due = f.due.slice(0, 7) <= c.ym ? `К ${dayTitle(f.due)} не хватило ${money(f.target_minor - has)} — сдвиньте дату в плане` : null;
  if (missed > 0) {
    const where = c.budget ? ` — пойдут в остаток ${monthWords(c.ym).gen}` : '';
    return [`${money(missed)} не потрачены${where}. Следующие взносы станут больше`, due].filter(Boolean).join('. ');
  }
  return due;
}

/** Step "Копилки": each fund's contribution of the month — did it go in. Unanswered, it doesn't count in the fund. */
export default function StepFunds({ c, onAnswer }: Props) {
  const total = c.funds.reduce((a, f) => a + f.planned_minor, 0);
  const one = c.funds.every((f) => f.currency === c.funds[0]?.currency);
  return (
    <View style={[styles.block, styles.funds]}>
      <View style={styles.head}>
        <Text style={styles.headText}>Копилки</Text>
        {one ? <Text style={styles.headText}>{formatWithCurrency(total, c.funds[0].currency)}</Text> : null}
      </View>
      <Text style={styles.muted}>Взнос засчитывается в копилку, когда вы ответите, что отложили</Text>
      {c.funds.map((f, i) => {
        const label = `${f.emoji ?? ''} ${f.name}`.trim();
        const note = fundNote(f, c);
        return (
          <View key={f.category_id} style={[styles.fund, i < c.funds.length - 1 && styles.fundRule]}>
            <View style={styles.line}>
              <Text style={styles.lineText}>{`${label} · взнос`}</Text>
              <Text style={styles.lineValue}>{formatWithCurrency(f.planned_minor, f.currency)}</Text>
            </View>
            <AmountAnswer asked={f.planned_minor} currency={f.currency} answered={f.confirmed_minor} label={`Отложено в «${label}»`}
              onAnswer={(minor) => onAnswer(f.category_id, minor)} onReset={() => onAnswer(f.category_id, null)} />
            {note ? <Text style={styles.muted}>{note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
