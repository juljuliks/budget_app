import React from 'react';
import { Text, View } from 'react-native';
import type { MonthClose, PaymentChoice } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import Choice from './Choice';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (categoryId: number, choice: PaymentChoice) => void };

/**
 * Step "Платежи": the month's one-off payments not paid (a part paid — the rest). Each: «Перенести на декабрь» — in
 * December's plan, its money with the leftover moved («Остаток ноября»), or «Не нужен» — its money stays «Сэкономлено».
 */
export default function StepPayments({ c, onAnswer }: Props) {
  const m = monthWords(c.ym);
  const next = monthWords(c.next_ym);
  const total = c.payments.reduce((a, p) => a + p.unpaid_budget_minor, 0);
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.headText}>{`Не оплачено в ${m.prep}`}</Text>
        <Text style={styles.headText}>{formatWithCurrency(total, c.currency)}</Text>
      </View>
      <Text style={styles.muted}>
        {`Деньги на них не потрачены. Перенесёте — уйдут в ${next.nom} вместе с платежом, бюджет ${next.gen} их не платит.`}
      </Text>
      {c.payments.map((p) => {
        const money = (minor: number) => formatWithCurrency(minor, p.currency);
        const label = `${p.emoji ? `${p.emoji} ` : ''}${p.name}`;
        return (
          <View key={p.category_id} style={styles.stack}>
            <View style={styles.line}>
              <Text style={styles.question}>{label}</Text>
              <Text style={styles.question}>{money(p.unpaid_minor)}</Text>
            </View>
            {p.paid_minor > 0 ? <Text style={styles.muted}>{`оплачено ${money(p.paid_minor)} из ${money(p.planned_minor)}`}</Text> : null}
            <Choice<PaymentChoice>
              options={[
                { value: 'next', title: `Перенести на ${next.nom}`, note: `в плане ${next.gen} — ${money(p.unpaid_minor)}, в «Остатке ${m.gen}» +${money(p.unpaid_minor)}` },
                { value: 'drop', title: 'Не нужен', note: `${money(p.unpaid_minor)} останутся в «Сэкономлено»` },
              ]}
              value={p.choice} onChange={(v) => onAnswer(p.category_id, v)}
            />
          </View>
        );
      })}
    </View>
  );
}
