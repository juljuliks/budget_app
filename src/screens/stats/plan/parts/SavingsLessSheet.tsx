import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { Currency } from '@/db/fx';
import { coverWithUndo } from '@/entities/plan';
import { CoverRoom, lessLines, Overspent, SavingsLess } from '../model/savingsLess';
import CoverRooms from './CoverRooms';

type Props = {
  ym: string;
  /** the budget's: what `less` is counted in */
  currency: Currency;
  less: SavingsLess | null;
  visible: boolean;
  money: (minor: number) => string;
  onClose: () => void;
  /** a category's plan (a tap on it) */
  onOpen: (categoryId: number) => void;
};

function Row({ o, money, onOpen, onCover }: { o: Overspent; money: (minor: number) => string; onOpen?: () => void; onCover?: () => void }) {
  const body = (
    <>
      <Text style={styles.emoji}>{o.emoji ?? ''}</Text>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{o.name}</Text>
        <Masked style={styles.note}>{`${o.category_id === null ? 'доля' : 'план'} ${money(o.plan)} · потрачено ${money(o.spent)}`}</Masked>
      </View>
      <Masked style={styles.over}>{`−${money(o.over)}`}</Masked>
    </>
  );
  if (onOpen) return <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`План: ${o.name}`}>{body}</TouchableOpacity>;
  return (
    <View style={onCover ? undefined : styles.row}>
      <View style={onCover ? styles.rowTop : styles.inner}>{body}</View>
      {onCover ? (
        <TouchableOpacity style={styles.coverLink} onPress={onCover} accessibilityRole="button">
          <Text style={styles.link}>Покрыть из плана ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * ⓘ of the savings the overspend took part of (and the warning over the stats): by how much, what each part will be if the
 * rest is spent by plan (💰, 🔒, the funds' contributions, the savings from before — what none of them covers), and every
 * category past its plan (the spending outside the plan past its share too), the biggest first; a tap opens its plan.
 * The spending outside the plan: "Покрыть из плана ›" — the limits with something left to take it of (CoverRooms).
 */
export default function SavingsLessSheet({ ym, currency, less, visible, money, onClose, onOpen }: Props) {
  const [picking, setPicking] = useState(false);
  useEffect(() => { if (!visible) setPicking(false); }, [visible]);
  const over = less?.overs.find((o) => o.category_id === null)?.over ?? 0;
  const cover = (r: CoverRoom) => {
    onClose();
    coverWithUndo(ym, r.take, over, currency, { label: r.name, category_id: r.category_id });
  };
  return (
    <BottomSheet visible={visible && !!less} onClose={onClose} title={!less ? '' : picking ? 'Покрыть из плана' : `Сбережения меньше на ${money(less.less)}`}>
      {less && picking ? (
        <SheetScrollView contentContainerStyle={styles.content}>
          <CoverRooms rooms={less.rooms} over={over} money={money} onPick={cover} />
          <SheetActions submit={null} onCancel={() => setPicking(false)} cancelTitle="Назад" />
        </SheetScrollView>
      ) : less ? (
        <SheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>Эти категории потратили больше плана. Если дальше тратить по плану:</Text>
          {lessLines(less, money).map((l) => <Masked key={l} style={styles.part}>{l}</Masked>)}
          {less.overs.map((o) => (
            <Row
              key={o.key} o={o} money={money} onOpen={o.category_id === null ? undefined : () => { onClose(); onOpen(o.category_id!); }}
              onCover={o.category_id === null && less.rooms.length ? () => setPicking(true) : undefined}
            />
          ))}
          <Text style={styles.hint}>Тап по категории — изменить её план</Text>
          <SheetActions submit={{ title: 'Понятно', onPress: onClose }} />
        </SheetScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  lead: { fontSize: 14, color: colors.muted, marginBottom: 6 },
  part: { fontSize: 15, color: colors.text, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 },
  coverLink: { paddingTop: 4, paddingBottom: 12, paddingLeft: 36, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  link: { fontSize: 14, color: colors.accent },
  emoji: { fontSize: 20, width: 26 },
  text: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  over: { fontSize: 16, color: colors.danger, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, color: colors.muted, marginTop: 10 },
});
