import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { MonthSavings } from '../model/savings';

type Props = { s: MonthSavings; money: (minor: number) => string };

function Extra({ name, value }: { name: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailName, styles.detailText]}>{name}</Text>
      <Text style={styles.detailNum} />
      <Text style={styles.detailNum}>{value}</Text>
    </View>
  );
}

/**
 * The opened month's "Сбережения", under its categories: 🔒 "Отложено сразу" and 💰 "Сэкономлено" against the plan, and what
 * they make; a fund deleted that month gives what it had saved. The current month: "Сейчас", the obligatory payments not
 * paid yet already out of the leftover.
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
            <Text style={styles.detailText}>🔒 Отложено сразу</Text>
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
          <Text style={styles.detailText}>{over ? s.rest.label : `💰 ${s.rest.label}`}</Text>
          <Text style={styles.detailHint}>
            {over ? 'потрачено больше бюджета' : s.pending ? 'без неоплаченных обязательных' : 'не потрачено к концу месяца'}
          </Text>
        </View>
        <Text style={[styles.detailNum, styles.muted]}>{s.rest.plan !== null ? money(s.rest.plan) : '—'}</Text>
        <Text style={[styles.detailNum, over ? styles.danger : s.rest.value > 0 && styles.good]}>{money(s.rest.value)}</Text>
      </View>
      {s.released.map((r) => (
        <View key={r.name} style={styles.detailRow}>
          <View style={styles.detailName}>
            <Text style={styles.detailText}>{`Из копилки «${`${r.emoji ?? ''} ${r.name}`.trim()}»`}</Text>
            <Text style={styles.detailHint}>копилка удалена</Text>
          </View>
          <Text style={[styles.detailNum, styles.muted]}>—</Text>
          <Text style={[styles.detailNum, styles.good]}>{money(r.minor)}</Text>
        </View>
      ))}
      <View style={[styles.detailRow, styles.totalRow]}>
        <Text style={[styles.detailName, styles.strong]}>
          {s.pending ? 'Пока в сбережения' : s.label === 'Перерасход' ? 'Перерасход бюджета' : s.label === 'В сбережения' ? 'Всего в сбережения'
            : s.label === 'Перенесено' ? 'Не потрачено' : 'Сэкономлено'}
        </Text>
        <Text style={styles.detailNum} />
        <Text style={[styles.detailNum, styles.strong, over ? styles.danger : styles.good]}>{money(s.total)}</Text>
      </View>
      {/* what its "Итоги" said: the leftover moved, what was put aside */}
      {s.label === 'Перенесено' ? <Extra name="Перенесено в следующий месяц" value={money(s.value)} /> : null}
      {s.saved !== null && s.saved !== s.total ? <Extra name="Удалось отложить" value={money(s.saved)} /> : null}
      {s.pending && s.unpaidFixed > 0 ? (
        <Text style={styles.note}>
          Месяц идёт: из «Сэкономлено» вычтены обязательные платежи, которые ещё не оплачены ({money(s.unpaidFixed)}). Итог — в конце месяца.
        </Text>
      ) : null}
    </View>
  );
}
