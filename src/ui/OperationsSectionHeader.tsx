import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Checkbox from '@/shared/ui/Checkbox';
import { plural } from '@/shared/lib/format';
import { formStyles } from '@/shared/theme/formStyles';
import { ChevronRightIcon } from '@/shared/ui/icons';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { groupTotal } from './transactionGroups';
import type { Section } from './transactionsListData';

type Props = {
  section: Section;
  selecting: boolean;
  /** every operation of a group or a day, once its checkbox was first ticked */
  ids: number[] | undefined;
  selected: Set<number>;
  /** a day's spending (by day only) */
  spent: number;
  currency: string;
  onToggle: () => void;
  /** the stats of this day */
  onOpenDay: () => void;
};

/** A section's header in the operations list: a group's title, count and total, or a day's with its spending. */
export default function OperationsSectionHeader({ section, selecting, ids, selected, spent, currency, onToggle, onOpenDay }: Props) {
  const g = section.group;
  if (g) {
    const checked = !!ids && ids.every((id) => selected.has(id));
    const n = g.count;
    return (
      <View style={[formStyles.sectionHeader, styles.header]}>
        {/* one operation: its own checkbox picks it, the header's would repeat it */}
        {selecting && n > 1 ? (
          <TouchableOpacity testID={`group-checkbox-${section.title}`} onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }}>
            <Checkbox checked={checked} size={18} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{section.title} · {n} {plural(n, ['операция', 'операции', 'операций'])}</Text>
        <Text style={styles.amount}>{groupTotal(g)}</Text>
      </View>
    );
  }
  const checked = ids ? ids.every((id) => selected.has(id)) : section.data.every((r) => selected.has(r.id));
  const count = ids?.length ?? section.data.length;
  return (
    <View style={[formStyles.sectionHeader, styles.header]}>
      {/* selecting: the day's operations at once (as a group's; one operation has its own) */}
      {selecting && count > 1 ? (
        <TouchableOpacity testID={`day-checkbox-${section.key}`} onPress={onToggle} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }}>
          <Checkbox checked={checked} size={18} />
        </TouchableOpacity>
      ) : null}
      <Text style={styles.title}>{section.title}</Text>
      {spent > 0 ? <Text style={styles.amount}>−{formatWithCurrency(spent, currency)}</Text> : null}
      <TouchableOpacity onPress={onOpenDay} hitSlop={10} accessibilityLabel={`Траты за день: ${section.title}`}>
        <ChevronRightIcon color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  amount: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
