import React from 'react';
import { Text, View } from 'react-native';
import type { CloseAnswers, MonthClose } from '@/db/plans';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthWords } from '../model/closeTexts';
import { styles } from './styles';

type Props = { c: MonthClose; onAnswer: (patch: Partial<CloseAnswers>) => void };

function Row({ n, name, note, value, of, warn, action }: {
  n: number; name: string; note: string; value: string; of?: string; warn?: boolean; action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={styles.splitRow}>
      <Text style={styles.splitNum}>{n}</Text>
      <View style={styles.splitBody}>
        <Text style={styles.splitName} numberOfLines={1}>{name}</Text>
        <Text style={[styles.splitNote, warn && styles.headOver]}>
          {note}
          {action ? <Text style={styles.link} onPress={action.onPress} accessibilityRole="button">{` · ${action.title}`}</Text> : null}
        </Text>
      </View>
      <View style={styles.splitValueBox}>
        <Text style={styles.splitValue}>{value}</Text>
        {of ? <Text style={styles.splitOf}>{of}</Text> : null}
      </View>
    </View>
  );
}

/**
 * What was put aside laid out (or would be — "Разложим так"): the funds, the nearest due first (one short — "не хватило
 * …, следующие взносы станут больше"; one the overspend took part of — "перерасход −…"), 🔒 "Отложено сразу", 💰 "Сэкономлено" ("Перенести на октябрь" — the leftover
 * to the next month's budget instead).
 */
export default function SplitRows({ c, onAnswer }: Props) {
  const s = c.split ?? c.planned;
  const answered = c.split !== null;
  const b = c.budget;
  const money = (minor: number, cur: string = c.currency) => formatWithCurrency(minor, cur);
  const next = monthWords(c.next_ym);
  let n = 0;
  const moved = c.answers.rest_choice === 'next';
  return (
    <>
      {s.funds.map((part) => {
        const f = c.funds.find((x) => x.category_id === part.category_id)!;
        // the overspend took part of it ("Из сбережений")
        const cut = f.planned_minor - f.asked_minor;
        const short = answered && part.minor < f.asked_minor;
        const note = short ? `не хватило ${money(f.asked_minor - part.minor, f.currency)} — следующие взносы станут больше`
          : cut > 0 ? `перерасход −${money(cut, f.currency)} — следующие взносы станут больше` : `копилка · к ${dayTitle(f.due)}`;
        return (
          <Row
            key={f.category_id} n={++n} name={`${f.emoji ?? ''} ${f.name}`.trim()} warn={short || cut > 0} note={note}
            value={`${money(part.minor, f.currency)}${answered && !short ? ' ✓' : ''}`}
            of={short ? `из ${money(f.asked_minor, f.currency)}` : cut > 0 ? `из ${money(f.planned_minor, f.currency)}` : undefined}
          />
        );
      })}
      {b && b.kept_locked_minor > 0 ? (
        <Row
          n={++n} name="🔒 Отложено сразу" note={answered && s.locked === 0 ? 'не отложено' : 'в начале месяца'}
          value={money(s.locked)} of={answered && s.locked < b.kept_locked_minor ? `из ${money(b.kept_locked_minor)}` : undefined}
        />
      ) : null}
      {b && (b.rest_minor > 0 || s.rest > 0) ? (
        <Row
          n={++n} name="💰 Сэкономлено" value={money(moved ? b.rest_minor : s.rest)}
          note={moved ? `перенесено на ${next.nom}` : 'в сбережения'}
          action={moved ? { title: 'В сбережения', onPress: () => onAnswer({ rest_choice: 'savings' }) }
            : c.can_carry && b.rest_minor > 0 ? { title: `Перенести на ${next.nom}`, onPress: () => onAnswer({ rest_choice: 'next' }) } : undefined}
        />
      ) : null}
    </>
  );
}
