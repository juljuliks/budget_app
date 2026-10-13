import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { openMonthClose, openMonthReport } from '@/shared/navigation/sheets';
import { Currency } from '@/db/fx';
import { currentYm, HistoryMonth, parseYm } from '@/db/plans';
import Meter from '@/shared/ui/Meter';
import { ChevronDownIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthTitle } from '@/shared/lib/dates';
import MonthDetails from './MonthDetails';
import { styles } from './styles';
import { monthSavings } from '../model/savings';

function Total({ label, value, danger, good, muted }: { label: string; value: string; danger?: boolean; good?: boolean; muted?: boolean }) {
  return (
    <View style={styles.total}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.totalValue, danger && styles.danger, good && styles.good, muted && styles.muted]}>{value}</Text>
    </View>
  );
}

type Props = { month: HistoryMonth; expanded: boolean; onToggle: () => void; currency: Currency };

/**
 * A month of the History: the plan against the spending, the budget, and what went to savings as its "Итоги месяца" said
 * ("В сбережения", "Перенесено", "Сэкономлено"; the current month "пока", less the obligatory payments not paid yet).
 * Not closed yet: "Итоги не подведены" and "Подвести итоги ›"; closed — "Изменить итоги ›".
 */
export default function MonthRow({ month, expanded, onToggle, currency }: Props) {
  const { year, month: m } = parseYm(month.ym);
  const { planned_minor: planned, spent_minor: spent } = month;
  const diff = planned - spent;
  const budget = month.budget_minor;
  const savings = monthSavings(month, month.ym === currentYm());
  const money = (minor: number) => formatWithCurrency(minor, currency);

  return (
    <View style={styles.month}>
      <TouchableOpacity onPress={onToggle}>
        <View style={styles.monthTop}>
          <Text style={styles.monthTitle}>{monthTitle(year, m)}</Text>
          {/* the app's chevron, as on «за месяц» and the filters: up while open */}
          <View style={expanded && styles.chevronOpen} accessibilityLabel={expanded ? 'Свернуть' : 'Раскрыть'}>
            <ChevronDownIcon color={colors.accent} size={18} />
          </View>
        </View>
        <View style={styles.totals}>
          <Total label="План" value={planned ? money(planned) : '—'} />
          <Total label="Потрачено" value={money(spent)} />
          <Total
            label={planned ? (diff >= 0 ? 'Осталось' : 'Перерасход') : ''}
            value={planned ? `${diff < 0 ? '⚠ ' : ''}${money(Math.abs(diff))}` : ''}
            danger={planned > 0 && diff < 0}
          />
        </View>
        {planned ? <Meter ratio={spent / planned} /> : null}
        {/* the funds' contributions are in the plan and the spending: what of it was put aside */}
        {month.funds_minor > 0 ? <Text style={styles.fundsLine}>{`В копилки ${money(month.funds_minor)}`}</Text> : null}
        {budget !== null && savings ? (
          // the amount to distribute: what was left unplanned, and what went to savings (or was not spent)
          <View style={styles.totals}>
            <Total label="Бюджет" value={money(budget)} />
            <Total label="Свободно" value={money(Math.max(budget - planned, 0))} />
            <Total
              label={savings.label}
              value={`${savings.total < 0 ? '⚠ ' : ''}${savings.pending ? 'пока ' : ''}${money(Math.abs(savings.value))}${savings.open ? ' ?' : ''}`}
              danger={savings.total < 0}
              good={savings.value > 0 && !savings.pending && !savings.open}
              muted={(savings.pending || savings.open) && savings.total >= 0}
            />
          </View>
        ) : null}
      </TouchableOpacity>
      {/* a month over whose "Итоги" aren't done */}
      {month.close && !month.close.closed ? (
        <View style={styles.openClose}>
          <Text style={styles.openCloseText}>Итоги не подведены: удалось ли отложить, взносы в копилки</Text>
          <TouchableOpacity onPress={() => openMonthClose(month.ym)} hitSlop={6} accessibilityRole="button">
            <Text style={styles.reportText}>Подвести итоги ›</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {/* a month that is over and had a plan (a budget or a category with an amount); its "Итоги" can be changed */}
      {month.ym < currentYm() && (month.budget_minor !== null || month.planned_minor > 0) ? (
        <View style={styles.links}>
          <TouchableOpacity style={styles.reportLink} onPress={() => openMonthReport(month.ym)} hitSlop={6}>
            <Text style={styles.reportText}>Отчёт за месяц ›</Text>
          </TouchableOpacity>
          {month.close?.closed ? (
            <TouchableOpacity style={styles.reportLink} onPress={() => openMonthClose(month.ym)} hitSlop={6}>
              <Text style={styles.reportText}>Изменить итоги ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {expanded ? <MonthDetails ym={month.ym} currency={currency} savings={savings} /> : null}
    </View>
  );
}
