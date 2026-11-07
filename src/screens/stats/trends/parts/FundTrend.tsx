import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import { FundSheet } from '@/features/fund';
import { currentYm } from '@/db/plans';
import { MONTHS_DAT, MONTHS_NOM, MONTHS_PREP, monthYear } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { openPlan } from '@/shared/navigation/navigation';
import Masked from '@/shared/ui/Masked';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import type { FundTrend as Fund } from '@/stats/subsFundTrend';
import { detailStyles as s } from './detailStyles';

const UP = 84;
const DOWN = 40;
/** «к июню 2027» */
const byMonth = (ym: string) => `к ${MONTHS_DAT[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
const months = (n: number) => `${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;

/**
 * «Динамика» of a category with a fund: how much of its target by when, put aside (up) against spent from it (down) by
 * month — a month without a plan dashed; the pace to its date, the months without a contribution, what was short, on what
 * it was spent; its card (contributions and spending, «Изменить», «Удалить копилку»).
 */
export default function FundTrend({ f, categoryId, label, money }: { f: Fund; categoryId: number; label: string; money: (minor: number) => string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [card, setCard] = useState(false);
  const max = Math.max(1, ...f.bars.map((b) => Math.max(b.saved, b.spent)));
  const bar = picked === null ? null : f.bars[picked];
  const offset = f.forecast?.offset ?? 0;
  const cell = (title: string, value: string, warn?: boolean) => (
    <View style={s.cell}><Text style={s.label}>{title}</Text><Masked style={[s.value, warn && { color: colors.warn }]}>{value}</Masked></View>
  );
  return (
    <>
      <View style={s.head}>
        <Text>
          <Masked style={[s.spent, { color: colors.fundText }]}>{money(f.balance)}</Masked>
          <Text style={s.spentWhen}>{` из ${money(f.target)} · ${byMonth(f.due.slice(0, 7))}`}</Text>
        </Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (f.balance / Math.max(1, f.target)) * 100)}%` }]} /></View>
      <Text style={s.line}>
        {f.left > 0 ? `взнос ${money(f.contribution)} в месяц · осталось ${money(f.left)} за ${months(f.monthsLeft)}` : 'Накоплено всё'}
      </Text>
      <View style={styles.chart} accessibilityLabel="Отложено и потрачено по месяцам">
        {f.bars.map((b, i) => (
          <TouchableOpacity key={b.ym} style={styles.col} onPress={() => setPicked(i)} accessibilityLabel={MONTHS_NOM[Number(b.ym.slice(5)) - 1]}>
            <View style={styles.up}>
              {b.planned ? <View style={[styles.saved, { height: Math.round((b.saved / max) * UP) }, b.current && styles.now]} /> : <View style={styles.none} />}
            </View>
            <View style={styles.down}>{b.spent > 0 ? <View style={[styles.spent, { height: Math.max(2, Math.round((b.spent / max) * DOWN)) }]} /> : null}</View>
            <Text style={[styles.month, b.current && styles.monthNow]}>{MONTHS_NOM[Number(b.ym.slice(5)) - 1].slice(0, 1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.point}>
        {bar ? `${monthYear(bar.ym)}: +${money(bar.saved)}${bar.spent ? ` · потрачено ${money(bar.spent)}` : ''}`
          : 'Вверх — отложено, вниз — потрачено из копилки'}
      </Text>
      {f.forecast && f.left > 0 ? (
        <View style={s.block}>
          <Text style={s.label}>Темп</Text>
          <Text style={[s.value, { color: offset > 0 ? colors.warn : colors.income }]}>
            {`В таком темпе — ${byMonth(f.forecast.ym)}${offset < 0 ? `, на ${months(-offset)} раньше` : offset > 0 ? `, на ${months(offset)} позже` : ', как раз к сроку'}`}
          </Text>
          {f.pace !== null ? <Text style={s.label}>{`в среднем ${money(f.pace)} в месяц`}</Text> : null}
        </View>
      ) : null}
      <View style={[s.block, s.grid]}>
        {cell('Отложено за всё время', money(f.savedAll))}
        {cell('Потрачено из копилки', money(f.spentAll))}
        {f.skipped.length ? cell('Месяцев без взноса', `${f.skipped.length} · ${MONTHS_NOM[Number(f.skipped[f.skipped.length - 1].slice(5)) - 1]}`) : null}
        {f.shortage ? cell('Не хватило', `${money(f.shortage.total)} · ${MONTHS_PREP[Number(f.shortage.ym.slice(5)) - 1]}`, true) : null}
      </View>
      {f.merchants.length ? (
        <View style={s.block}>
          <Text style={s.label}>На что тратили</Text>
          {f.merchants.map((m) => (
            <View key={m.key ?? m.name} style={s.merchant}>
              {m.key ? <MerchantLink merchantKey={m.key} label={m.name} containerStyle={s.merchantName} /> : <Text style={[s.value, s.merchantName]}>{m.name}</Text>}
              <Masked style={s.value}>{money(m.value)}</Masked>
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.operations}>
        <TextLink label="Копилка: взносы и траты" onPress={() => setCard(true)} />
      </View>
      <FundSheet categoryId={card ? categoryId : null} label={label} onClose={() => setCard(false)} onEdit={() => { setCard(false); openPlan(currentYm()); }} />
    </>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.fundTrack, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', backgroundColor: colors.fund },
  chart: { flexDirection: 'row', gap: 6, marginTop: 16 },
  col: { flex: 1, alignItems: 'stretch' },
  up: { height: UP, justifyContent: 'flex-end', borderBottomWidth: 1, borderColor: colors.faint },
  saved: { backgroundColor: colors.fundTrack, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  now: { backgroundColor: colors.fund },
  none: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
  down: { height: DOWN },
  spent: { backgroundColor: colors.impulse, opacity: 0.75, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  month: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 4 },
  monthNow: { color: colors.text },
});
