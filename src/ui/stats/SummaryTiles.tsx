import React from 'react';
import { useFolded } from '../fold';

const NO_DEFAULTS: string[] = [];
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { parseDayKey, shortRange } from '../dateRange';
import { ChevronDownIcon } from '../icons';
import Meter from '../Meter';
import { PER_PERIOD } from '../strings';
import { colors } from '../theme';
import { pct, SummaryGroup, SummaryGroupKey } from './summaryGroups';

export const GROUP_TITLES: Record<SummaryGroupKey, string> = {
  day: 'Дневные', week: 'Недельные', '2weeks': 'Двухнедельные', month: 'Месячные', fixed: 'Обязательные', outside: 'Вне плана',
};
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const GAP = 8;

/** "вс" for a week's last day, "31 окт" for the month's */
const until = (g: SummaryGroup) => (g.key === 'month' || g.key === 'fixed' || g.key === 'outside' ? shortRange({ from: g.end, to: g.end }) : WEEKDAYS[parseDayKey(g.end).getDay()]);
/** the screen's side padding (styles.content of the stats) */
const SIDE = 16;

type Props = {
  groups: SummaryGroup[];
  /** "120 ₾" */
  money: (minor: number) => string;
  /** a block tapped: its calculation; none = the tiles only show */
  onPress?: (key: SummaryGroupKey) => void;
};

/**
 * "ЛИМИТЫ ⌄": the tiles folded under a header, opened by a tap. The period stats start it open, the month dashboard
 * folded; "N в перерасходе" on the header says whether opening it is worth it.
 */
export function LimitsAccordion({ defaultOpen, foldKey, ...props }: Props & { defaultOpen: boolean; /** remembered under this key */ foldKey: string }) {
  // folded or not, remembered per screen; the default until the user taps
  const defaults = React.useMemo(() => (defaultOpen ? NO_DEFAULTS : [foldKey]), [defaultOpen, foldKey]);
  const fold = useFolded('limits', defaults);
  const open = !fold.is(foldKey);
  const setOpen = () => fold.toggle(foldKey);
  // an outside-the-plan block without a share has no limit to be over
  const over = props.groups.filter((g) => g.limit > 0 && g.spent > Math.round(g.limit)).length;
  return (
    <View>
      <TouchableOpacity
        style={styles.header}
        onPress={setOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Свернуть лимиты' : 'Показать лимиты'}
      >
        <Text style={styles.headerTitle}>Лимиты</Text>
        {over > 0 ? <Text style={styles.headerOver}>{over} в перерасходе</Text> : null}
        <View style={open ? styles.chevronOpen : undefined}><ChevronDownIcon color={colors.muted} size={16} /></View>
      </TouchableOpacity>
      {open ? <SummaryTiles {...props} /> : null}
    </View>
  );
}

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
        // outside the plan without a share: just its spending, no limit
        const plain = g.key === 'outside' && limit === 0;
        const over = !plain && left < 0;
        const byMonth = g.key === 'month' || g.key === 'fixed' || g.key === 'outside';
        const subtitle = byMonth && !plain ? MONTHS[parseDayKey(g.end).getMonth()] : g.window ? shortRange(g.window) : null;
        const paid = g.items.filter((i) => i.spent >= i.limit).length;
        const caption = plain ? 'категории без плана'
          : over ? 'перерасход'
            : g.key === 'fixed' ? (left > 0 ? 'осталось оплатить' : 'всё оплачено')
            // "до вс" when the measured days go on past the viewed period (a weekly limit's week, the month)
            : g.ongoing ? `осталось${g.window ? ` · до ${until(g)}` : ''}`
              : 'сэкономлено';
        const moved = g.change && g.change.after !== null && Math.round(g.change.after) !== Math.round(g.change.before);
        return (
          <TouchableOpacity
            key={g.key}
            style={[styles.tile, { width: tile }]}
            onPress={onPress ? () => onPress(g.key) : undefined}
            disabled={!onPress}
            accessibilityLabel={`${GROUP_TITLES[g.key]}: ${caption}`}
            accessibilityHint={onPress ? 'Показать расчёт' : undefined}
          >
            <View>
              <Text style={styles.title} numberOfLines={1}>{GROUP_TITLES[g.key]}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {/* the numbers at the bottom: blocks of different heights keep them on one line */}
            <View style={styles.body}>
            {/* obligatory payments: what's still to pay is not free money — grey, no "+" */}
            <Text style={[styles.big, plain ? null : over ? styles.over : g.key === 'fixed' ? styles.due : styles.ok]} numberOfLines={1} adjustsFontSizeToFit>
              {plain ? money(g.spent) : g.key === 'fixed' && !over ? (left > 0 ? money(left) : '✓') : `${over ? '−' : '+'}${money(Math.abs(left))}`}
            </Text>
            <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
            {!plain ? (
              <>
                <Text style={styles.ofLimit} numberOfLines={1}>
                  {g.key === 'fixed' ? `${paid} из ${g.items.length} оплачены` : `${money(g.spent)} из ${m(g.limit)} (${pct(g.spent, limit)})`}
                </Text>
                {limit > 0 ? (
                  g.spent > limit
                    ? <Meter ratio={1} over={limit / g.spent} height={6} color={colors.warn} />
                    : <Meter ratio={g.spent / limit} height={6} color={colors.income} />
                ) : null}
              </>
            ) : null}
            {/* categories left out: their month's plan is overspent, no limit left (the sheet names them) */}
            {g.overspent?.length ? (
              <Text style={styles.change} numberOfLines={1}>
                {`без ${g.overspent.length} в перерасходе месяца`}
              </Text>
            ) : null}
            {g.change && (g.key === 'day' || g.key === 'week' || g.key === '2weeks') ? (
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 8 },
  headerTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  headerOver: { fontSize: 13, color: colors.warn },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  strip: { marginHorizontal: -SIDE, marginBottom: 8 },
  stripContent: { paddingHorizontal: SIDE, gap: GAP, alignItems: 'stretch' },
  tile: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, justifyContent: 'space-between' },
  body: { marginTop: 6 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted },
  subtitle: { fontSize: 12, color: colors.muted },
  big: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ok: { color: colors.income },
  due: { color: colors.text },
  over: { color: colors.warn },
  caption: { fontSize: 12, color: colors.muted },
  ofLimit: { fontSize: 12, color: colors.text, marginTop: 6, fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, color: colors.muted, marginTop: 6, fontVariant: ['tabular-nums'] },
  crossed: { textDecorationLine: 'line-through' },
});
