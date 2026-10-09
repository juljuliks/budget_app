import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '../../db/categories';
import { currentYm, parseYm } from '../../db/plans';
import { AVERAGE_MONTHS, MonthReport, monthReport, ReportCategory, yearly } from '../../db/report';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import { navigateWhenReady } from '../../navigation';
import { openMonthReport } from '../../sheets';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { monthDays } from '@/shared/lib/dateRange';
import { plural } from '@/shared/lib/format';
import { ChevronRightIcon, InfoIcon } from '@/shared/ui/icons';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import Masked from '../Masked';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { monthTitle } from '@/shared/lib/dates';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';

const SAVINGS = '#0d9488';

/** The report of `ym` (null = none yet), reloaded when operations or plans change. */
function useMonthReport(ym: string | null): MonthReport | null {
  const currency = useDisplayCurrency();
  const [report, setReport] = useState<MonthReport | null>(null);
  useEffect(() => {
    if (!ym) { setReport(null); return undefined; }
    let stale = false;
    const load = () => monthReport(ym, currency).then((r) => { if (!stale) setReport(r); }).catch((e) => console.error('load month report failed', e));
    setReport(null);
    load();
    const off = onTransactionsChanged(load);
    return () => { stale = true; off(); };
  }, [ym, currency]);
  return report;
}

const title = (ym: string) => { const { year, month } = parseYm(ym); return monthTitle(year, month); };

/**
 * One line opening the report of a past month: "Отложено 1 200 ₾ · могли ещё 410 ₾ ›" (the stats of the month,
 * «История»).
 */
export function MonthReportRow({ ym }: { ym: string }) {
  const r = useMonthReport(ym);
  // no plan that month: no report
  if (!r || !r.hasPlan) return null;
  const money = (v: number) => formatWithCurrency(v, r.currency);
  return (
    <TouchableOpacity style={styles.row} onPress={() => openMonthReport(ym)} accessibilityHint="Открыть отчёт за месяц">
      <Text style={styles.rowText} numberOfLines={2}>
        {r.saved === null ? `Потрачено ${money(r.spent)}`
          : r.saved >= 0 ? <>Отложено <Masked style={styles.savedInline}>{money(r.saved)}</Masked></>
            : <Text style={styles.over}>Бюджет превышен на {money(-r.saved)}</Text>}
        {r.couldSaveMore > 0 ? <Text style={styles.muted}> · могли ещё {money(r.couldSaveMore)}</Text> : null}
      </Text>
      <ChevronRightIcon color={colors.accent} />
    </TouchableOpacity>
  );
}

/** The month's report in a sheet (sheets.ts → openMonthReport): from the notification, «История», the stats. */
export function MonthReportSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const r = useMonthReport(ym);
  const currency = useDisplayCurrency();
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  const money = (v: number) => formatWithCurrency(Math.round(v), r?.currency ?? currency);
  // a year is an estimate: whole units
  const perYear = (v: number) => formatWithCurrency(Math.round(yearly(v) / 100) * 100, r?.currency ?? currency);

  // the month's operations without a category, on the operations page
  function sortOut() {
    if (!ym) return;
    onClose();
    navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: { category: 'none', range: monthDays(ym), nonce: Date.now(), from: 'Stats' } } } as never);
  }

  const diff = r && r.saved !== null && r.previousSaved !== null ? Math.round(r.saved - r.previousSaved) : 0;
  const better = Math.max(0, diff);
  const worse = Math.max(0, -diff);
  // each block's amounts this month; the header shows them together × 12, its ⓘ lists them
  const badParts: Array<[string, number]> = r ? ([
    // "взято из отложенного" is a consequence of these, not added to them
    ['перерасход лимитов', r.overLimitsTotal], ['вне плана сверх доли', r.unplannedOver], ['меньше, чем месяцем раньше', worse],
  ] as Array<[string, number]>).filter(([, v]) => v > 0) : [];
  const goodParts: Array<[string, number]> = r ? ([
    ['сэкономлено в плане', r.savedInPlan], ['переведено в «Сбережения» вручную', r.movedToSavings], ['больше, чем месяцем раньше', better],
  ] as Array<[string, number]>).filter(([, v]) => v > 0) : [];
  const badMonth = badParts.reduce((a, [, v]) => a + v, 0);
  const goodMonth = goodParts.reduce((a, [, v]) => a + v, 0);
  const goodYear = goodMonth;
  /** "Перерасход лимитов 150 ₾ + вне плана сверх доли 400 ₾ = 550 ₾ за месяц; × 12 = 6 600 ₾." */
  const yearInfo = (parts: Array<[string, number]>, sign: string, tail: string) => {
    const total = parts.reduce((a, [, v]) => a + v, 0);
    const list = parts.map(([l, v]) => `${l} ${money(v)}`).join(' + ');
    return `${list.charAt(0).toUpperCase()}${list.slice(1)}${parts.length > 1 ? ` = ${money(total)}` : ''} за месяц; × 12 = ${sign}${perYear(total)}. ${tail}`;
  };
  const improve = !!r && (badMonth > 0 || r.lockedTouched > 0 || r.review || r.uncategorizedCount > 0 || r.unpaid.length > 0 || worse > 0);
  const good = !!r && (goodYear > 0 || (r.locked > 0 && r.lockedTouched === 0) || (r.saved !== null && r.overLimits.length === 0) || (r.unplannedSpent > 0 && r.unplannedOver === 0 && !r.review));
  // what "вне плана" means here
  const unplannedInfo = r ? `Вне плана — траты в категориях без суммы в плане и без категории (переводы тоже): ${money(r.unplannedSpent)}. `
    + (r.unplannedShare > 0 ? `На них выделена доля бюджета ${money(r.unplannedShare)}; ` : 'Доли бюджета на них не выделено; ')
    + (r.unplannedSpent > r.unplannedShare ? `сверх неё — ${money(r.unplannedSpent - r.unplannedShare)}: эти деньги не отложились.` : `из неё осталось ${money(r.unplannedShare - r.unplannedSpent)}.`) : '';
  const plus = (v: number) => `+${money(v)}`;
  const minus = (v: number) => `−${money(v)}`;

  return (
    <BottomSheet visible={ym !== null} onClose={onClose} title={ym ? `Отчёт · ${title(ym)}` : ''}>
      {!r ? <ActivityIndicator style={styles.loading} /> : !r.hasPlan ? (
        // an old notification of a month whose plan is gone
        <Text style={[styles.hint, styles.content]}>Плана на этот месяц не было — отчёта нет.</Text>
      ) : (
        <SheetScrollView contentContainerStyle={styles.content}>
          {/* what was put aside, and that a year */}
          {r.saved === null ? (
            <Text style={styles.hint}>Бюджет месяца не задан: потрачено {money(r.spent)}. Задайте бюджет в плане, чтобы видеть, сколько откладывается.</Text>
          ) : r.saved >= 0 ? (
            <View style={styles.hero}>
              <Text style={styles.caption}>{r.toSavings ? 'В сбережения' : 'Отложено'}</Text>
              <Masked style={styles.heroValue}>{money(r.saved)}</Masked>
              {r.average ? (
                <YearInfo info={averageInfo(r, money, perYear)}>
                  ≈ <Masked style={styles.caption}>{perYear(r.average.saved)}</Masked> за год
                  {r.average.months.length > 1 ? ` · в среднем за ${r.average.months.length} мес.` : ' в таком темпе'}
                </YearInfo>
              ) : null}
              {r.previousSaved !== null && Math.round(r.saved) !== Math.round(r.previousSaved) ? (
                <Text style={[styles.caption, r.saved > r.previousSaved ? styles.good : styles.over]}>
                  На {money(Math.abs(r.saved - r.previousSaved))} {r.saved > r.previousSaved ? 'больше' : 'меньше'}, чем месяцем раньше
                </Text>
              ) : null}
              {/* where it comes from: the three parts add up to it */}
              {r.savedFrom ? (
                <View style={styles.from}>
                  {r.savedFrom.locked > 0 ? <FromLine label="🔒 Сразу" v={r.savedFrom.locked} money={money} /> : null}
                  {/* not distributed is money the plan left without a purpose: worth planning, so red */}
                  <FromLine label="Свободно в плане" v={r.savedFrom.undistributed} money={money} bad />
                  <FromLine label={r.savedFrom.plan >= 0 ? 'Категории плана потратили меньше' : 'Категории плана потратили больше'} v={r.savedFrom.plan} money={money} />
                  {r.unplannedShare > 0 || r.savedFrom.unplanned !== 0 ? (
                    <FromLine label={r.savedFrom.unplanned >= 0 ? 'Не потрачено из доли вне плана' : 'Вне плана сверх доли'} v={r.savedFrom.unplanned} money={money} info={unplannedInfo} />
                  ) : null}
                  {r.movedToSavings > 0 ? <FromLine label="Из них переведено в «Сбережения» вручную" v={r.movedToSavings} money={money} /> : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.hero}>
              <Text style={styles.caption}>Бюджет превышен на</Text>
              <Text style={[styles.heroValue, styles.over]}>{money(-r.saved)}</Text>
              <Text style={styles.caption}>Потрачено {money(r.spent)} при бюджете {money(r.budget!)}</Text>
            </View>
          )}

          {/* what to improve: every amount red with a minus, each with what it costs a year */}
          {improve ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>Что можно улучшить</Text>
                {badMonth > 0 ? (
                  <YearInfo style={[styles.blockValue, styles.over]} info={yearInfo(badParts, '−', 'Столько не получится отложить за год, если так будет каждый месяц.')}>
                    ≈ −{perYear(badMonth)} в год
                  </YearInfo>
                ) : null}
              </View>
              {r.overLimitsTotal > 0 ? (
                <>
                  <Line label="Перерасход лимитов" value={minus(r.overLimitsTotal)} strong valueStyle={styles.bad} />
                  {r.overLimits.map((c) => (
                    <CategoryLine key={String(c.id)} c={c} note={`план ${money(c.limit)}, факт ${money(c.spent)}`} value={minus(c.spent - c.limit)} valueStyle={styles.bad} />
                  ))}
                </>
              ) : null}
              {/* spending outside the plan, one group: past its share (what it costs) and how much of all spending it is */}
              {r.unplannedOver > 0 || r.review ? (
                <>
                  {r.unplannedOver > 0 ? (
                    <Line label="Вне плана сверх доли" value={minus(r.unplannedOver)} strong valueStyle={styles.bad} info={unplannedInfo} />
                  ) : (
                    <Line label="Вне плана" value={minus(r.unplannedSpent)} strong valueStyle={styles.bad} />
                  )}
                  <Text style={styles.blockCaption}>
                    {r.unplannedShare > 0 ? `Доля ${money(r.unplannedShare)}, потрачено ${money(r.unplannedSpent)}` : `Потрачено ${money(r.unplannedSpent)}, доли на это нет`}
                    {` · ${Math.round(r.unplannedOfSpending * 100)}% всех трат`}
                    {r.review ? '. Если эти траты повторяются, их стоит запланировать' : ''}
                  </Text>
                  <UnplannedCategories r={r} minus={minus} onPlan={setPlanTarget} currency={currency} />
                </>
              ) : null}
              {r.uncategorizedCount > 0 ? (
                <TouchableOpacity style={styles.lineRow} onPress={sortOut}>
                  <Text style={[styles.lineLabel, styles.lineStrong]}>
                    Без категории: {r.uncategorizedCount} {plural(r.uncategorizedCount, ['операция', 'операции', 'операций'])}
                  </Text>
                  <Text style={styles.link}>Разметить</Text>
                </TouchableOpacity>
              ) : null}
              {r.unpaid.length ? (
                <>
                  <Line label="Обязательные не оплачены" strong />
                  {r.unpaid.map((c) => <CategoryLine key={String(c.id)} c={c} note="нет операции за месяц" value={minus(c.limit)} valueStyle={styles.bad} />)}
                </>
              ) : null}
              {r.lockedTouched > 0 ? (
                <Line label="🔒 Взято из отложенного" value={minus(r.lockedTouched)} strong valueStyle={styles.bad}
                  info={`Отложено сразу ${money(r.locked)}. Тратить можно было бюджет минус отложенное: ${money(r.budget! - r.locked)}, потрачено ${money(r.spent)} — на ${money(r.lockedTouched)} больше, они взяты из отложенного.`} />
              ) : null}
              {worse > 0 ? <Line label="Отложено меньше, чем месяцем раньше" value={minus(worse)} strong valueStyle={styles.bad} /> : null}
              {r.saved !== null && r.couldSaveMore > 0 ? (
                <Text style={styles.blockCaption}>
                  Без перерасхода отложили бы <Masked style={styles.blockCaption}>{money(Math.max(0, r.saved) + r.couldSaveMore)}</Masked>
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* what is already good: every amount with a plus */}
          {good ? (
            <View style={[styles.block, styles.goodBlock]}>
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>Что уже хорошо</Text>
                {goodMonth > 0 ? (
                  <YearInfo style={[styles.blockValue, styles.good]} info={yearInfo(goodParts, '+', 'Столько это даст за год, если так будет каждый месяц.')}>
                    ≈ +{perYear(goodMonth)} в год
                  </YearInfo>
                ) : null}
              </View>
              {r.locked > 0 && r.lockedTouched === 0 ? <Line label={`✓ Отложенное не тронуто: 🔒 ${money(r.locked)}`} /> : null}
              {r.overLimits.length === 0 && r.saved !== null ? <Line label="✓ Лимиты категорий соблюдены" /> : null}
              {r.unplannedSpent > 0 && r.unplannedOver === 0 && !r.review ? (
                <Line label={`✓ Вне плана в пределах доли: ${money(r.unplannedSpent)} из ${money(r.unplannedShare)}`} />
              ) : null}
              {r.savedInPlan > 0 ? (
                <>
                  <Line label="Сэкономлено в плане" value={plus(r.savedInPlan)} strong valueStyle={styles.good} />
                  {r.underPlan.map((c) => (
                    <CategoryLine key={String(c.id)} c={c} note={`план ${money(c.limit)}, факт ${money(c.spent)}`} value={plus(c.limit - c.spent)} valueStyle={styles.good} />
                  ))}
                </>
              ) : null}
              {r.movedToSavings > 0 ? (
                <Line label="Переведено в «Сбережения» вручную" value={plus(r.movedToSavings)} strong valueStyle={styles.good} />
              ) : null}
              {better > 0 ? <Line label="Отложено больше, чем месяцем раньше" value={plus(better)} strong valueStyle={styles.good} /> : null}
            </View>
          ) : null}
        </SheetScrollView>
      )}
      {/* planned into the report's own month */}
      <PlanAmountModal ym={ym ?? currentYm()} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={() => setPlanTarget(null)} />
    </BottomSheet>
  );
}

/** "Перерасход лимитов   34.77 ₾" with "≈ 417 ₾ в год" under the amount */
function Line({ label, value, year, info, strong, indent, valueStyle }: {
  label: string; value?: string; year?: string; info?: string; strong?: boolean; indent?: boolean; valueStyle?: object;
}) {
  return (
    <View style={styles.lineRow}>
      <InfoLabel style={[styles.lineLabel, strong && styles.lineStrong, indent && styles.indent]} info={info}>{label}</InfoLabel>
      {value ? (
        <View style={styles.lineValues}>
          <Text style={[styles.lineValue, strong && styles.lineStrong, valueStyle]}>{value}</Text>
          {year ? <Text style={styles.lineYear}>{year}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** "+ Свободно в плане   1 000 ₾": one part of what was put aside. */
function FromLine({ label, v, money, bad, info }: { label: string; v: number; money: (v: number) => string; bad?: boolean; info?: string }) {
  return (
    <View style={styles.lineRow}>
      <InfoLabel style={[styles.lineLabel, styles.fromLabel]} info={info}>{label}</InfoLabel>
      <Masked style={[styles.lineValue, bad || v < 0 ? styles.bad : styles.good]}>{`${v < 0 ? '−' : '+'}${money(Math.abs(v))}`}</Masked>
    </View>
  );
}

/** A row's label, with ⓘ after it when there is something to explain. */
function InfoLabel({ info, style, children }: { info?: string; style: object | object[]; children: React.ReactNode }) {
  if (!info) return <Text style={style} numberOfLines={2}>{children}</Text>;
  return (
    <TouchableOpacity style={[styles.infoLabel]} onPress={() => sheetAlert('Как посчитано', info)} hitSlop={6} accessibilityHint="Как посчитано">
      <Text style={[style, styles.shrinkLabel]} numberOfLines={2}>{children}</Text>
      <InfoIcon color={colors.accent} size={14} />
    </TouchableOpacity>
  );
}

/** The year's estimate with ⓘ: a tap explains the average behind it. */
function YearInfo({ info, style, children }: { info?: string; style?: object | object[]; children: React.ReactNode }) {
  const text = <Text style={[style ?? styles.caption, styles.shrink]}>{children}</Text>;
  if (!info) return text;
  return (
    <TouchableOpacity style={styles.yearInfo} onPress={() => sheetAlert('Как посчитано', info)} hitSlop={6} accessibilityHint="Как посчитано">
      {text}
      <InfoIcon color={colors.accent} size={14} />
    </TouchableOpacity>
  );
}

/** The ⓘ of the year's estimate: the average of the latest months with data × 12. */
function averageInfo(r: MonthReport, money: (v: number) => string, perYear: (v: number) => string): string {
  const a = r.average!;
  const names = a.months.map((m) => `${title(m.ym).split(' ')[0].toLowerCase()} ${money(m.saved)}`).join(', ');
  const avg = a.months.length > 1 ? `(${a.months.map((m) => money(m.saved)).join(' + ')}) / ${a.months.length} = ${money(a.saved)}` : money(a.saved);
  return `Отложено в среднем за месяц: ${avg}; × 12 = ${perYear(a.saved)}.\n\nМесяцы: ${names}. Берутся до ${AVERAGE_MONTHS} последних `
    + 'месяцев с бюджетом и полными данными (операции с первой половины месяца): один удачный или неудачный месяц меньше качает оценку.';
}

/** One category in the report, the same in both blocks: name, "план X, факт Y" under it, the amount right; "＋ В план" optional. */
function CategoryLine({ c, note, value, valueStyle, onPlan }: {
  c: ReportCategory; note: string; value: string; valueStyle?: object; onPlan?: () => void;
}) {
  return (
    <View style={styles.catRow}>
      <View style={styles.catText}>
        <Text style={styles.catName} numberOfLines={1}>{categoryLabel(c)}</Text>
        <Text style={styles.catNote} numberOfLines={1}>{note}</Text>
      </View>
      <Text style={[styles.lineValue, valueStyle]}>{value}</Text>
      {onPlan ? (
        <TouchableOpacity onPress={onPlan} style={styles.planButton} hitSlop={8} accessibilityLabel={`Добавить в план: ${c.name}`}>
          <Text style={styles.planText}>＋ В план</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** The biggest categories outside the plan, with "＋ В план" (into the report's month). */
function UnplannedCategories({ r, minus, onPlan, currency }: {
  r: MonthReport; minus: (v: number) => string; onPlan: (t: PlanAmountTarget) => void; currency: MonthReport['currency'];
}) {
  return (
    <>
      {r.topUnplanned.map((c) => (
        <CategoryLine
          key={String(c.id)}
          c={c}
          note="без плана"
          value={minus(c.spent)}
          valueStyle={styles.bad}
          onPlan={() => onPlan({ category_id: c.id!, label: categoryLabel(c), limit_minor: 0, currency, suggested_minor: Math.round(c.spent) })}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 8, gap: 2 },
  heroValue: { fontSize: 30, fontWeight: '700', color: SAVINGS, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  blockCaption: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 14, color: colors.muted },
  block: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 6 },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  blockTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  blockValue: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineLabel: { flex: 1, fontSize: 14, color: colors.text },
  lineValue: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  lineValues: { alignItems: 'flex-end' },
  lineYear: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  infoLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrinkLabel: { flex: 0, flexShrink: 1 },
  yearInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  goodBlock: { backgroundColor: '#ECFDF5' },
  lineStrong: { fontWeight: '600' },
  indent: { paddingLeft: 12, color: colors.muted },
  link: { fontSize: 14, color: colors.accent },
  from: { alignSelf: 'stretch', marginTop: 10, gap: 4 },
  fromLabel: { fontSize: 13, color: colors.muted },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12 },
  catText: { flex: 1 },
  catName: { fontSize: 14, color: colors.text },
  catNote: { fontSize: 12, color: colors.muted },
  planButton: { borderWidth: 1, borderColor: colors.accent, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 },
  planText: { fontSize: 13, color: colors.accent },
  good: { color: colors.income },
  over: { color: colors.warn },
  bad: { color: colors.danger },
  muted: { color: colors.muted },
  row: {
    marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.surface,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowText: { flex: 1, fontSize: 14, color: colors.text },
  savedInline: { fontSize: 14, fontWeight: '600', color: SAVINGS },
});
