import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { monthToClose } from '@/db/plans';
import { getSetting, setSetting } from '@/db/settings';
import { onTransactionsChanged } from '@/domain/events';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { MONTHS } from '@/shared/lib/dates';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { openMonthClose } from '@/shared/navigation/sheets';
import Banner from '@/shared/ui/Banner';
import TextLink from '@/shared/ui/TextLink';
import { toastFailure } from '@/shared/ui/toast';
import { font, space, weight } from '@/shared/theme/tokens';

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
    <Banner
      title={`${month} не закрыт`}
      text="Подведите итоги: удалось ли отложить и взносы в копилки"
      alert
      close={{
        label: 'Скрыть до завтра',
        onPress: () => {
          setYm(null);
          setSetting(HIDDEN_KEY, dayKeyOf(new Date())).catch(toastFailure('hide close banner', SAVE_FAILED));
        },
      }}
      style={styles.box}
    >
      <TextLink label="Подвести итоги" onPress={() => openMonthClose(ym)} style={styles.link} />
    </Banner>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: space[16], marginBottom: space[8] },
  link: { fontSize: font.secondary, fontWeight: weight.medium },
});
