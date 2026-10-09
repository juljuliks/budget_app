// The report's rows: a line with its amount, a part of what was put aside, a category, the year's estimate.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { ReportCategory } from '@/db/report';
import { InfoIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { colors } from '@/shared/theme/theme';
import { styles } from './styles';

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

/** "Перерасход лимитов   34.77 ₾" with "≈ 417 ₾ в год" under the amount */
export function Line({ label, value, year, info, strong, indent, valueStyle }: {
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
export function FromLine({ label, v, money, bad, info }: { label: string; v: number; money: (v: number) => string; bad?: boolean; info?: string }) {
  return (
    <View style={styles.lineRow}>
      <InfoLabel style={[styles.lineLabel, styles.fromLabel]} info={info}>{label}</InfoLabel>
      <Masked style={[styles.lineValue, bad || v < 0 ? styles.bad : styles.good]}>{`${v < 0 ? '−' : '+'}${money(Math.abs(v))}`}</Masked>
    </View>
  );
}

/** The year's estimate with ⓘ: a tap explains the average behind it. */
export function YearInfo({ info, style, children }: { info?: string; style?: object | object[]; children: React.ReactNode }) {
  const text = <Text style={[style ?? styles.caption, styles.shrink]}>{children}</Text>;
  if (!info) return text;
  return (
    <TouchableOpacity style={styles.yearInfo} onPress={() => sheetAlert('Как посчитано', info)} hitSlop={6} accessibilityHint="Как посчитано">
      {text}
      <InfoIcon color={colors.accent} size={14} />
    </TouchableOpacity>
  );
}

/** One category in the report, the same in both blocks: name, "план X, факт Y" under it, the amount right; "＋ В план" optional. */
export function CategoryLine({ c, note, value, valueStyle, onPlan }: {
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
