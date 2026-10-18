import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fundOfTransaction } from '@/db/plans';
import { savingOfTransaction } from '@/db/subscriptions';
import { formatWithCurrency } from '@/shared/lib/money';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';

type Props = { txId: number; categoryId: number | null; merchantKey: string | null; occurredAt: number; amount: number };

type At = { before: number; after: number; currency: string; saving?: string };

/**
 * An operation in a fund's category: "Из копилки — не из бюджета месяца", what the fund had before it and after; a
 * subscription's charge paid from what was saved for it: "Из отложенного — не из бюджета месяца".
 */
export default function FundNote({ txId, categoryId, merchantKey, occurredAt, amount }: Props) {
  const [at, setAt] = useState<At | null>(null);
  useEffect(() => {
    let live = true;
    (async (): Promise<At | null> => {
      const fund = await fundOfTransaction(txId, categoryId, occurredAt);
      if (fund) return fund;
      const saving = await savingOfTransaction(txId, merchantKey, occurredAt);
      return saving ? { ...saving, saving: saving.name } : null;
    })().then((r) => { if (live) setAt(r); }).catch((e) => console.error('fund of transaction failed', e));
    return () => { live = false; };
    // the amount changed: the fund's before / after too
  }, [txId, categoryId, merchantKey, occurredAt, amount]);
  if (!at) return null;
  const money = (minor: number) => formatWithCurrency(minor, at.currency);
  return (
    <View style={styles.box}>
      <ProgressRing ratio={at.before ? at.after / at.before : 0} color={colors.fund} track={colors.fundTrack} />
      <View style={styles.text}>
        <Text style={styles.title}>{at.saving ? 'Из отложенного — не из бюджета месяца' : 'Из копилки — не из бюджета месяца'}</Text>
        <Text style={styles.note}>
          {`${at.saving ? `на ${at.saving} было отложено` : 'в копилке было'} ${money(at.before)} → осталось ${money(at.after)}`}
        </Text>
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
