import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { parseDayKey, shortRange } from '../dateRange';
import Meter from '../Meter';
import { PER_PERIOD } from '../strings';
import { colors } from '../theme';
import { pct, SummaryGroup, SummaryGroupKey } from './summaryGroups';

export const GROUP_TITLES: Record<SummaryGroupKey, string> = {
  day: 'Дневные', week: 'Недельные', '2weeks': 'Двухнедельные', month: 'Месячные', outside: 'Вне лимитов',
};
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const GAP = 8;

/** "вс" for a week's last day, "31 окт" for the month's */
const until = (g: SummaryGroup) => (g.key === 'month' ? shortRange({ from: g.end, to: g.end }) : WEEKDAYS[parseDayKey(g.end).getDay()]);
/** the screen's side padding (styles.content of the stats) */
const SIDE = 16;

type Props = {
  groups: SummaryGroup[];
  /** "120 ₾" */
  money: (minor: number) => string;
  /** a block tapped: its calculation */
  onPress: (key: SummaryGroupKey) => void;
};

/**
 * The limits of the period by rhythm, as tiles under the donut: what's left / the overspend big, spent of the limit,
 * a bar like the category rows', and how the period moved the limit. Two fill the row; more scroll sideways.
 */
export default function SummaryTiles({ groups, money, onPress }: Props) {
  const { width } = useWindowDimensions();
  const inner = width - SIDE * 2;
  // two share the row; with more, the third peeks out to show the row scrolls
  const tile = groups.length <= 2 ? (inner - GAP * (groups.length - 1)) / groups.length : inner * 0.44;
  const m = (v: number) => money(Math.round(v));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={groups.length > 2}
      snapToInterval={tile + GAP}
      decelerationRate="fast"
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
    >
      {groups.map((g) => {
        const limit = Math.round(g.limit);
        const left = limit - g.spent;
        const over = g.key !== 'outside' && left < 0;
        const subtitle = g.key === 'month' ? MONTHS[parseDayKey(g.end).getMonth()] : g.window ? shortRange(g.window) : null;
        const caption = g.key === 'outside' ? 'обязательные, переводы, без плана'
          : over ? 'перерасход'
            // "до вс" when the measured days go on past the viewed period (a weekly limit's week, the month)
            : g.ongoing ? `осталось${g.window ? ` · до ${until(g)}` : ''}`
              : 'сэкономлено';
        const moved = g.change && g.change.after !== null && Math.round(g.change.after) !== Math.round(g.change.before);
        return (
          <TouchableOpacity
            key={g.key}
            style={[styles.tile, { width: tile }]}
            onPress={() => onPress(g.key)}
            accessibilityLabel={`${GROUP_TITLES[g.key]}: ${caption}`}
            accessibilityHint="Показать расчёт"
          >
            <View>
              <Text style={styles.title} numberOfLines={1}>{GROUP_TITLES[g.key]}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {/* the numbers at the bottom: blocks of different heights keep them on one line */}
            <View style={styles.body}>
            <Text style={[styles.big, g.key === 'outside' ? null : over ? styles.over : styles.ok]} numberOfLines={1} adjustsFontSizeToFit>
              {g.key === 'outside' ? money(g.spent) : `${over ? '−' : '+'}${money(Math.abs(left))}`}
            </Text>
            <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
            {g.key !== 'outside' ? (
              <>
                <Text style={styles.ofLimit} numberOfLines={1}>{money(g.spent)} из {m(g.limit)} ({pct(g.spent, limit)})</Text>
                {limit > 0 ? (
                  g.spent > limit
                    ? <Meter ratio={1} over={limit / g.spent} height={6} color={colors.warn} />
                    : <Meter ratio={g.spent / limit} height={6} color={colors.income} />
                ) : null}
              </>
            ) : null}
            {g.change && g.key !== 'month' && g.key !== 'outside' ? (
              <Text style={styles.change} numberOfLines={2}>
                {moved ? (
                  <>
                    <Text style={styles.crossed}>{m(g.change.before)}</Text>{' → '}
                    <Text style={g.change.after! < g.change.before ? styles.over : styles.ok}>{m(g.change.after!)}</Text>
                  </>
                ) : `лимит ${m(g.change.before)}`} {PER_PERIOD[g.key]}
              </Text>
            ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -SIDE, marginBottom: 8 },
  stripContent: { paddingHorizontal: SIDE, gap: GAP, alignItems: 'stretch' },
  tile: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, justifyContent: 'space-between' },
  body: { marginTop: 6 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted },
  subtitle: { fontSize: 12, color: colors.muted },
  big: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ok: { color: colors.income },
  over: { color: colors.warn },
  caption: { fontSize: 12, color: colors.muted },
  ofLimit: { fontSize: 12, color: colors.text, marginTop: 6, fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, color: colors.muted, marginTop: 6, fontVariant: ['tabular-nums'] },
  crossed: { textDecorationLine: 'line-through' },
});
