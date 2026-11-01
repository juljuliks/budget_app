import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CategoryStat } from '@/db/plans';
import { styles } from './styles';

type Props = {
  title: string;
  /** the section's plan (the categories' amounts, or the share outside the plan); 0 — "—" */
  planned: number;
  spent: number;
  categories: CategoryStat[];
  money: (minor: number) => string;
  onOpen: (c: CategoryStat) => void;
};

/** Spent within the plan: green; past it: red with ⚠; no plan: plain. */
function tone(planned: number | null, spent: number) {
  if (!planned) return null;
  return spent > planned ? styles.danger : styles.good;
}

/** A section of the opened month: its band with the plan and the spending, then its categories, as in the stats. */
export default function DetailGroup({ title, planned, spent, categories, money, onOpen }: Props) {
  return (
    <View>
      <View style={[styles.detailRow, styles.groupRow]}>
        <Text style={[styles.detailName, styles.groupTitle]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.detailNum, styles.groupTitle]}>{planned ? money(planned) : '—'}</Text>
        <Text style={[styles.detailNum, styles.groupTitle, tone(planned, spent)]}>{money(spent)}</Text>
      </View>
      {categories.map((c) => {
        const over = !!c.limit_minor && c.spent_minor > c.limit_minor;
        return (
          <TouchableOpacity key={String(c.category_id)} style={styles.detailRow} onPress={() => onOpen(c)}>
            <Text style={styles.detailName} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
            <Text style={styles.detailNum}>{c.limit_minor ? money(c.limit_minor) : '—'}</Text>
            <Text style={[styles.detailNum, tone(c.limit_minor, c.spent_minor)]}>{over ? '⚠ ' : ''}{money(c.spent_minor)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
