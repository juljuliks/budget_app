import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import type { PlanAmountTarget } from '@/entities/plan';
import { plural } from '@/shared/lib/format';
import Masked from '@/shared/ui/Masked';
import type { ReportView } from '../model/reportView';
import { CategoryLine, Line, YearInfo } from './Lines';
import { styles } from './styles';

type Props = { v: ReportView; currency: Currency; onPlan: (t: PlanAmountTarget) => void; onSortOut: () => void };

/** What to improve: every amount red with a minus, the block's cost a year in its header. */
export default function ImproveBlock({ v, currency, onPlan, onSortOut }: Props) {
  const { r, money, minus, perYear } = v;
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>Что можно улучшить</Text>
        {v.badMonth > 0 ? (
          <YearInfo style={[styles.blockValue, styles.over]} info={v.yearInfo(v.badParts, '−', 'Столько не получится отложить за год, если так будет каждый месяц.')}>
            ≈ −{perYear(v.badMonth)} в год
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
            <Line label="Вне плана сверх доли" value={minus(r.unplannedOver)} strong valueStyle={styles.bad} info={v.unplannedInfo} />
          ) : (
            <Line label="Вне плана" value={minus(r.unplannedSpent)} strong valueStyle={styles.bad} />
          )}
          <Text style={styles.blockCaption}>
            {r.unplannedShare > 0 ? `Доля ${money(r.unplannedShare)}, потрачено ${money(r.unplannedSpent)}` : `Потрачено ${money(r.unplannedSpent)}, доли на это нет`}
            {` · ${Math.round(r.unplannedOfSpending * 100)}% всех трат`}
            {r.review ? '. Если эти траты повторяются, их стоит запланировать' : ''}
          </Text>
          {/* the biggest categories outside the plan, with "＋ В план" (into the report's month) */}
          {r.topUnplanned.map((c) => (
            <CategoryLine
              key={String(c.id)} c={c} note="без плана" value={minus(c.spent)} valueStyle={styles.bad}
              onPlan={() => onPlan({ category_id: c.id!, label: categoryLabel(c), limit_minor: 0, currency, suggested_minor: Math.round(c.spent) })}
            />
          ))}
        </>
      ) : null}
      {r.uncategorizedCount > 0 ? (
        <TouchableOpacity style={styles.lineRow} onPress={onSortOut}>
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
      {v.worse > 0 ? <Line label="Отложено меньше, чем месяцем раньше" value={minus(v.worse)} strong valueStyle={styles.bad} /> : null}
      {r.saved !== null && r.couldSaveMore > 0 ? (
        <Text style={styles.blockCaption}>
          Без перерасхода отложили бы <Masked style={styles.blockCaption}>{money(Math.max(0, r.saved) + r.couldSaveMore)}</Masked>
        </Text>
      ) : null}
    </View>
  );
}
