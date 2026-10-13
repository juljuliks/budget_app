import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fundOfTransaction } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';

type Props = { txId: number; categoryId: number | null; occurredAt: number; amount: number };

/** An operation in a fund's category: "Из копилки — не из бюджета месяца", what the fund had before it and after. */
export default function FundNote({ txId, categoryId, occurredAt, amount }: Props) {
  const [at, setAt] = useState<Awaited<ReturnType<typeof fundOfTransaction>>>(null);
  useEffect(() => {
    let live = true;
    fundOfTransaction(txId, categoryId, occurredAt).then((r) => { if (live) setAt(r); })
      .catch((e) => console.error('fund of transaction failed', e));
    return () => { live = false; };
    // the amount changed: the fund's before / after too
  }, [txId, categoryId, occurredAt, amount]);
  if (!at) return null;
  const money = (minor: number) => formatWithCurrency(minor, at.currency);
  return (
    <View style={styles.box}>
      <ProgressRing ratio={at.before ? at.after / at.before : 0} color={colors.fund} track={colors.fundTrack} />
      <View style={styles.text}>
        <Text style={styles.title}>Из копилки — не из бюджета месяца</Text>
        <Text style={styles.note}>{`в копилке было ${money(at.before)} → осталось ${money(at.after)}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: colors.fundBg },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.text },
  note: { fontSize: 13, color: colors.muted },
});
