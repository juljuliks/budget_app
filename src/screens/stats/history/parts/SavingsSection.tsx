import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { MonthSavings } from '../model/savings';

type Props = { s: MonthSavings; money: (minor: number) => string };

/**
 * The opened month's "Сбережения", under its categories: 🔒 "Сразу" and 🌊 "Что осталось" against the plan, and what
 * they make. The current month: "Сейчас", the obligatory payments not paid yet already out of the leftover.
 */
export default function SavingsSection({ s, money }: Props) {
  const over = s.total < 0;
  return (
    <View>
      <View style={[styles.detailRow, styles.savingsRow]}>
        <Text style={[styles.detailName, styles.savingsTitle]}>Сбережения</Text>
        <Text style={[styles.detailNum, styles.savingsTitle]}>План</Text>
        <Text style={[styles.detailNum, styles.savingsTitle]}>{s.pending ? 'Сейчас' : 'Отложено'}</Text>
      </View>
      {s.locked.plan > 0 ? (
        <View style={styles.detailRow}>
          <View style={styles.detailName}>
            <Text style={styles.detailText}>🔒 Сразу</Text>
            <Text style={styles.detailHint}>
              {s.locked.kept < s.locked.plan ? `${money(s.locked.plan - s.locked.kept)} ушло на траты` : 'в начале месяца'}
            </Text>
          </View>
          <Text style={[styles.detailNum, styles.muted]}>{money(s.locked.plan)}</Text>
          <Text style={[styles.detailNum, s.locked.kept > 0 && styles.good]}>{money(s.locked.kept)}</Text>
        </View>
      ) : null}
      <View style={styles.detailRow}>
        <View style={styles.detailName}>
          <Text style={styles.detailText}>{over ? s.rest.label : `🌊 ${s.rest.label}`}</Text>
          <Text style={styles.detailHint}>
            {over ? 'потрачено больше бюджета' : s.pending ? 'без неоплаченных обязательных' : 'не потрачено к концу месяца'}
          </Text>
        </View>
        <Text style={[styles.detailNum, styles.muted]}>{s.rest.plan !== null ? money(s.rest.plan) : '—'}</Text>
        <Text style={[styles.detailNum, over ? styles.danger : s.rest.value > 0 && styles.good]}>{money(s.rest.value)}</Text>
      </View>
      <View style={[styles.detailRow, styles.totalRow]}>
        <Text style={[styles.detailName, styles.strong]}>{s.pending ? `Пока ${s.label === 'В сбережения' ? 'в сбережения' : 'сэкономлено'}` : s.label === 'Перерасход' ? 'Перерасход бюджета' : s.label === 'В сбережения' ? 'Всего в сбережения' : 'Сэкономлено'}</Text>
        <Text style={styles.detailNum} />
        <Text style={[styles.detailNum, styles.strong, over ? styles.danger : styles.good]}>{money(s.total)}</Text>
      </View>
      {s.pending && s.unpaidFixed > 0 ? (
        <Text style={styles.note}>
          Месяц идёт: из «Что осталось» вычтены обязательные платежи, которые ещё не оплачены ({money(s.unpaidFixed)}). Итог — в конце месяца.
        </Text>
      ) : null}
    </View>
  );
}
