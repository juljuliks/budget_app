import React from 'react';
import { Text, View } from 'react-native';
import type { FundStat } from '@/db/plans';
import { styles } from './styles';

/** The opened month's "Копилки": each one's contribution (plan) and what was spent from it; a shortage is the month's. */
export default function FundRows({ funds, money }: { funds: FundStat[]; money: (minor: number) => string }) {
  const sum = (f: (x: FundStat) => number) => funds.reduce((a, x) => a + f(x), 0);
  return (
    <View>
      <View style={[styles.detailRow, styles.groupRow]}>
        <Text style={[styles.detailName, styles.groupTitle]}>Копилки</Text>
        <Text style={[styles.detailNum, styles.groupTitle]}>{money(sum((x) => x.contribution_minor))}</Text>
        <Text style={[styles.detailNum, styles.groupTitle]}>{money(sum((x) => x.spent_minor))}</Text>
      </View>
      {funds.map((f) => (
        <View key={f.category_id} style={styles.detailRow}>
          <View style={styles.detailName}>
            <Text style={styles.detailText} numberOfLines={1}>{`${f.emoji || ''} ${f.name}`.trim()}</Text>
            <Text style={styles.detailHint}>
              {f.shortage_minor > 0 ? `не хватило ${money(f.shortage_minor)}` : f.spent_minor > 0 ? 'из копилки' : 'взнос'}
            </Text>
          </View>
          <Text style={styles.detailNum}>{f.contribution_minor ? money(f.contribution_minor) : '—'}</Text>
          <Text style={[styles.detailNum, f.shortage_minor > 0 && styles.danger]}>{money(f.spent_minor)}</Text>
        </View>
      ))}
    </View>
  );
}
