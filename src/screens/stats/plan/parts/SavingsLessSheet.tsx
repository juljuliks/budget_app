import React, { useEffect, useState } from 'react';
import AmountRow from '@/shared/ui/AmountRow';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { Currency } from '@/db/fx';
import { coverWithUndo } from '@/entities/plan';
import { CoverRoom, lessLines, Overspent, SavingsLess } from '../model/savingsLess';
import CoverRooms from './CoverRooms';
import { font, space } from '@/shared/theme/tokens';
import TextLink from '@/shared/ui/TextLink';

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

function Row({
  o,
  money,
  onOpen,
  onCover,
}: {
  o: Overspent;
  money: (minor: number) => string;
  onOpen?: () => void;
  onCover?: () => void;
}) {
  const row = (
    <AmountRow
      large
      // with "Покрыть из плана" under it the line is under the link
      style={onCover && styles.noLine}
      onPress={onOpen}
      accessibilityLabel={onOpen ? `План: ${o.name}` : undefined}
      icon={<Text style={styles.emoji}>{o.emoji ?? ''}</Text>}
      title={o.name}
      notes={
        <Masked
          style={styles.note}
        >{`${o.category_id === null ? 'доля' : 'план'} ${money(o.plan)} · потрачено ${money(o.spent)}`}</Masked>
      }
      amount={<Masked style={styles.over}>{`−${money(o.over)}`}</Masked>}
    />
  );
  if (!onCover) return row;
  return (
    <View>
      {row}
      <TextLink label="Покрыть из плана" onPress={onCover} style={styles.link} containerStyle={styles.coverLink} />
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
  useEffect(() => {
    if (!visible) setPicking(false);
  }, [visible]);
  const over = less?.overs.find((o) => o.category_id === null)?.over ?? 0;
  const cover = (r: CoverRoom) => {
    onClose();
    coverWithUndo(ym, r.take, over, currency, { label: r.name, category_id: r.category_id });
  };
  return (
    <BottomSheet
      visible={visible && !!less}
      onClose={onClose}
      title={!less ? '' : picking ? 'Покрыть из плана' : `Сбережения меньше на ${money(less.less)}`}
    >
      {less && picking ? (
        <SheetScrollView contentContainerStyle={styles.content}>
          <CoverRooms rooms={less.rooms} over={over} money={money} onPick={cover} />
          <SheetActions submit={null} onCancel={() => setPicking(false)} cancelTitle="Назад" />
        </SheetScrollView>
      ) : less ? (
        <SheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>Эти категории потратили больше плана. Если дальше тратить по плану:</Text>
          {lessLines(less, money).map((l) => (
            <Masked key={l} style={styles.part}>
              {l}
            </Masked>
          ))}
          {less.overs.map((o) => (
            <Row
              key={o.key}
              o={o}
              money={money}
              onOpen={
                o.category_id === null
                  ? undefined
                  : () => {
                      onClose();
                      onOpen(o.category_id!);
                    }
              }
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

/** «Покрыть из плана ›» under a row's text, past its icon */
const TEXT_INDENT = 38;

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[20], paddingBottom: space[16] },
  lead: { fontSize: font.secondary, color: colors.muted, marginBottom: space[6] },
  part: { fontSize: font.body, color: colors.text, paddingVertical: space[2] },
  noLine: { borderBottomWidth: 0 },
  coverLink: {
    paddingTop: space[4],
    paddingBottom: space[12],
    paddingLeft: TEXT_INDENT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  link: { fontSize: font.secondary, color: colors.accent },
  emoji: { fontSize: font.heading },
  note: { fontSize: font.meta, color: colors.muted, marginTop: space[2] },
  over: { fontSize: font.input, color: colors.danger, fontVariant: ['tabular-nums'] },
  hint: { fontSize: font.meta, color: colors.muted, marginTop: space[10] },
});
