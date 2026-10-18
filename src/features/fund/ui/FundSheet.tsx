import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rowTitle } from '@/entities/transaction';
import { contributionsLeft, isSaved } from '@/entities/plan';
import { formatWithCurrency } from '@/shared/lib/money';
import { dayTitle, MONTHS } from '@/shared/lib/dates';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { openCategory } from '@/shared/navigation/navigation';
import Button from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { FundEntry } from '@/db/plans';
import { confirmDeleteFund } from '../model/commands';
import { useFund } from '../model/useFund';

type Props = {
  /** null = closed */
  categoryId: number | null;
  /** "🏖 Отпуск" */
  label: string;
  onClose: () => void;
  /** "Изменить": the plan's sheet of the category, as a fund */
  onEdit: () => void;
};

const monthOf = (ym: string) => MONTHS[Number(ym.slice(5)) - 1];

/** An entry's line: the month and what it was — a contribution, "уже отложено", an operation. */
function entryText(e: FundEntry): { month: string; what: string } {
  if (e.type === 'start') return { month: monthOf(e.ym), what: 'уже отложено' };
  if (e.type === 'contribution') return { month: monthOf(e.ym), what: e.current ? 'взнос, идёт' : 'взнос' };
  return { month: monthOf(e.ym), what: rowTitle(e) };
}

/**
 * A fund: what it has of the target, by when and the month's contribution; its contributions and spending, newest first.
 * "Изменить" opens the plan's sheet; "Удалить копилку" asks, what it has goes to this month's savings.
 */
export default function FundSheet({ categoryId, label, onClose, onEdit }: Props) {
  const { card, failed, load } = useFund(categoryId);
  const money = (minor: number) => formatWithCurrency(minor, card?.fund.currency);
  const saved = card ? isSaved(card.saved, card.fund.target_minor) : false;
  return (
    <BottomSheet visible={categoryId !== null} onClose={onClose} title={label} onTitlePress={categoryId !== null ? () => { onClose(); openCategory(categoryId); } : undefined}>
      {!card ? <Loading inline failed={failed} onRetry={load} /> : (
        <SheetScrollView contentContainerStyle={styles.body}>
          <View style={styles.amounts}>
            <Text style={styles.saved}>{money(card.saved)}</Text>
            <Text style={styles.of}>из {money(card.fund.target_minor)}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { flex: Math.min(1, card.saved / card.fund.target_minor) }]} /></View>
          <View style={styles.line}>
            <Text style={styles.lineText}>
              {saved ? 'Накоплено — можно тратить' : [`К ${dayTitle(card.fund.due)}`, contributionsLeft(card.left)].filter(Boolean).join(' · ')}
            </Text>
            {card.contribution > 0 ? <Text style={styles.lineValue}>{money(card.contribution)} в месяц</Text> : null}
          </View>
          {card.entries.length ? <Text style={formStyles.label}>Взносы и траты</Text> : null}
          {card.entries.map((e, i) => {
            const { month, what } = entryText(e);
            const out = e.type === 'spend';
            return (
              <View key={`${e.type}-${e.ym}-${e.type === 'spend' ? e.id : i}`} style={styles.entry}>
                <Text style={styles.entryText} numberOfLines={1}>{month}<Text style={styles.entryWhat}> · {what}</Text></Text>
                <Text style={[styles.entryAmount, !out && styles.in]}>{out ? `−${money(e.minor)}` : `+${money(e.minor)}`}</Text>
              </View>
            );
          })}
          <Text style={[formStyles.hint, styles.note]}>Траты категории «{label}» берутся из копилки и не тратят бюджет месяца.</Text>
          <View style={styles.actions}>
            <Button title="Изменить" onPress={onEdit} />
            {/* what it had at the month's start goes to the savings, this month's contribution back to the budget and its
                spending to the month's: the savings get what it has now */}
            <Button title="Удалить копилку" danger outline onPress={() => confirmDeleteFund(card.fund.category_id, label, card.saved, card.fund.currency, onClose)} />
          </View>
        </SheetScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  saved: { fontSize: 28, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  of: { fontSize: 16, color: colors.muted, fontVariant: ['tabular-nums'] },
  track: { flexDirection: 'row', height: 10, borderRadius: 5, backgroundColor: colors.fundTrack, overflow: 'hidden', marginTop: 10 },
  fill: { backgroundColor: colors.fund, borderRadius: 5 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  lineText: { flex: 1, fontSize: 14, color: colors.muted },
  lineValue: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  entry: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  entryText: { flex: 1, fontSize: 15, color: colors.text },
  entryWhat: { fontSize: 13, color: colors.muted },
  entryAmount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  in: { color: colors.fundText },
  note: { marginTop: 10 },
  actions: { gap: 10, marginTop: 14 },
});
