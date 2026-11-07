import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { currentYm, fundContribution, monthsBetween } from '@/db/plans';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import Button from '@/shared/ui/Button';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import DateField from '@/shared/ui/DateField';
import SwitchRow from '@/shared/ui/SwitchRow';
import TextLink from '@/shared/ui/TextLink';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { confirmDeleteFund, saveCategoryFund } from '../model/commands';
import { useCategoryFund } from '../model/useCategoryFund';
import { FUND_CARD, FUND_HINT_OFF, FUND_HINT_ON, FUND_SWITCH, months, SAVE_FUND, thisMonthText, zeroTitle } from '../texts';
import FundSheet from './FundSheet';

type Draft = { target: string; currency: Currency; due: string | null; start: string };

/**
 * A category's page: «Копилка» — how much by when and what was saved before; the month's contribution goes in the plan
 * by itself, fitted to the budget (what is free, then 🔒, the rest in the next months — said under the fields). Off
 * with a fund: asked, what it has goes to the month's savings. Not for a system or a transfer category.
 */
export default function FundSection({ categoryId }: { categoryId: number }) {
  const data = useCategoryFund(categoryId);
  const shown = useDisplayCurrency();
  const fund = data?.month?.fund ?? null;
  const [on, setOn] = useState(false);
  const [draft, setDraft] = useState<Draft>({ target: '', currency: shown, due: null, start: '' });
  const [card, setCard] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  useEffect(() => {
    setOn(!!fund);
    if (fund) setDraft({ target: toInputValue(fund.target_minor), currency: fund.currency, due: fund.due, start: fund.start_minor ? toInputValue(fund.start_minor) : '' });
  }, [fund]);
  const target = parseAmountOrZero(draft.target);
  const start = parseAmountOrZero(draft.start) ?? 0;
  const ym = currentYm();
  useEffect(() => {
    if (!on || !target || !draft.due) { setEstimate(null); return; }
    let live = true;
    fundContribution(ym, categoryId, { target_minor: target, currency: draft.currency, due: draft.due, start_minor: start })
      .then((c) => { if (live) setEstimate(c); }).catch((e) => console.error('fund contribution failed', e));
    return () => { live = false; };
  }, [on, target, start, draft.due, draft.currency, categoryId, ym]);
  if (!data?.allowed) return null;

  const changed = !fund || fund.target_minor !== target || fund.currency !== draft.currency || fund.due !== draft.due || fund.start_minor !== start;
  const count = draft.due ? monthsBetween(ym, draft.due.slice(0, 7)) : 0;
  const month = fund && !changed && data.month ? thisMonthText(data.month, ym) : null;
  const toggle = (v: boolean) => {
    if (v || !fund) { setOn(v); return; }
    confirmDeleteFund(categoryId, data.label, data.month?.saved ?? 0, fund.currency, () => setOn(false));
  };
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <>
      <SwitchRow label={FUND_SWITCH} hint={on ? FUND_HINT_ON : FUND_HINT_OFF} on={on} onChange={toggle} style={styles.row} />
      {on ? (
        <View>
          <Text style={formStyles.label}>Сколько накопить</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[formStyles.input, styles.amount]} value={draft.target} onChangeText={(t) => set({ target: t })} placeholder="0.00"
              placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Сколько накопить"
            />
            <CurrencyButton value={draft.currency} onChange={(c) => set({ currency: c })} />
          </View>
          <DateField
            label="К какой дате" value={draft.due} format={dayTitle} suffix={draft.due && count ? ` · через ${months(count)}` : null}
            sheetTitle="К какой дате накопить" minDay={dayKeyOf(new Date())} onChange={(d) => set({ due: d })}
          />
          <Text style={formStyles.label}>Уже отложено (необязательно)</Text>
          <TextInput
            style={formStyles.input} value={draft.start} onChangeText={(t) => set({ start: t })} placeholder="0.00"
            placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Уже отложено"
          />
          <View style={[styles.plate, month?.zero && styles.plateZero]}>
            {month?.zero && data.month ? <Text style={[styles.plateTitle, styles.zeroTitle]}>{zeroTitle(data.month, ym)}</Text>
              : estimate !== null ? <Text style={styles.plateTitle}>{`${formatWithCurrency(estimate, draft.currency)} в месяц · ${months(count)}`}</Text>
                : <Text style={[styles.plateTitle, styles.muted]}>{draft.due ? 'Введите, сколько накопить' : 'Выберите дату — посчитаем взнос в месяц'}</Text>}
            {month ? <Text style={[styles.plateText, month.zero && styles.zeroText]}>{month.text}</Text> : null}
          </View>
          {changed ? (
            <Button title={SAVE_FUND} disabled={!target || !draft.due} style={styles.save}
              onPress={() => { saveCategoryFund(categoryId, data.label, { target_minor: target!, currency: draft.currency, due: draft.due!, start_minor: start }); }} />
          ) : <TextLink label={FUND_CARD} onPress={() => setCard(true)} containerStyle={styles.card} />}
        </View>
      ) : null}
      <FundSheet categoryId={card ? categoryId : null} label={data.label} onClose={() => setCard(false)} onEdit={() => setCard(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0, marginTop: 16 },
  amountRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  amount: { flex: 1 },
  plate: { backgroundColor: colors.fundBg, borderRadius: 12, padding: 12, marginTop: 14, gap: 4 },
  plateZero: { backgroundColor: colors.warnBg },
  plateTitle: { fontSize: 15, fontWeight: '600', color: colors.fundText },
  zeroTitle: { color: colors.warn },
  plateText: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  zeroText: { color: colors.warn },
  muted: { color: colors.muted },
  save: { marginTop: 14 },
  card: { marginTop: 12 },
});
