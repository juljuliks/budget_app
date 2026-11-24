import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { monthToClose } from '@/db/plans';
import { getSetting, setSetting } from '@/db/settings';
import { onTransactionsChanged } from '@/domain/events';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { MONTHS } from '@/shared/lib/dates';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { openMonthClose } from '@/shared/navigation/sheets';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** the day ✕ hid the banner till: it comes back the next day */
const HIDDEN_KEY = 'close_banner_hidden';
/** the banner is up to this day of the month; then the month's "Итоги" are only offered in «История» */
const LAST_DAY = 3;

/**
 * Over every section of the stats, the 1st to the 3rd: a month over whose "Итоги месяца" aren't done (the oldest) —
 * "Подвести итоги ›" opens them; ✕ hides it till tomorrow.
 */
export default function CloseBanner() {
  const [ym, setYm] = useState<string | null>(null);
  const load = useCallback(() => {
    const now = new Date();
    if (now.getDate() > LAST_DAY) {
      setYm(null);
      return;
    }
    Promise.all([monthToClose(), getSetting(HIDDEN_KEY)])
      .then(([open, hidden]) => setYm(open && hidden !== dayKeyOf(now) ? open : null))
      .catch((e) => console.error('load close banner failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!ym) return null;
  const month = MONTHS[Number(ym.slice(5)) - 1];
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={styles.text}>
        <Text style={styles.title}>{`${month} не закрыт`}</Text>
        <Text style={styles.body}>Подведите итоги: удалось ли отложить и взносы в копилки</Text>
        <TouchableOpacity onPress={() => openMonthClose(ym)} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>Подвести итоги ›</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => {
          setYm(null);
          setSetting(HIDDEN_KEY, dayKeyOf(new Date())).catch(toastFailure('hide close banner', SAVE_FAILED));
        }}
        hitSlop={10}
        accessibilityLabel="Скрыть до завтра"
      >
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[10],
    marginHorizontal: space[16],
    marginBottom: space[8],
    paddingHorizontal: space[14],
    paddingVertical: space[12],
    borderRadius: radius.lg,
    backgroundColor: colors.warnBg,
  },
  text: { flex: 1, gap: space[2] },
  title: { fontSize: font.input, fontWeight: weight.semibold, color: colors.warn },
  body: { fontSize: font.secondary, color: colors.warn },
  link: { fontSize: font.secondary, fontWeight: weight.medium, color: colors.accent, marginTop: space[4] },
  close: { fontSize: font.input, color: colors.warn },
});
