import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { limitAlertsEnabled, setLimitAlertsEnabled } from '@/notifications/limitAlerts';
import { setDisplayCurrency, useDisplayCurrency } from '@/shared/settings/displayCurrency';
import CurrencyPicker from '@/shared/ui/CurrencyPicker';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED, SAVE_FAILED } from '@/shared/lib/strings';
import LockedPctSetting from './LockedPctSetting';
import { styles } from './styles';

/** «Бюджет»: the currency the app converts amounts to, «🔒 Отложить сразу», the limit notifications. */
export default function BudgetTab({ open }: { open: boolean }) {
  const currency = useDisplayCurrency();
  const [alerts, setAlerts] = useState(true);
  useEffect(() => {
    if (open) limitAlertsEnabled().then(setAlerts).catch(toastFailure('load limit alerts setting', LOAD_FAILED));
  }, [open]);
  const toggleAlerts = (on: boolean) => {
    setAlerts(on);
    // not saved: the switch goes back
    setLimitAlertsEnabled(on).catch((e) => { setAlerts(!on); toastFailure('save limit alerts setting', SAVE_FAILED)(e); });
  };
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.label}>Валюта</Text>
        <Text style={styles.hint}>
          Статистика, план, история и суммы за день пересчитываются в неё по курсу Нацбанка Грузии. Операции
          остаются в своей валюте.
        </Text>
        <CurrencyPicker value={currency} onChange={(c) => { setDisplayCurrency(c).catch(toastFailure('save currency', SAVE_FAILED)); }} />
      </View>
      <LockedPctSetting />
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Уведомлять о лимитах</Text>
          <Text style={styles.switchHint}>
            Когда траты категории доходят до 80% и 100% плана на месяц или лимита на день / неделю
          </Text>
        </View>
        <Switch
          value={alerts}
          onValueChange={toggleAlerts}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Уведомлять о лимитах"
        />
      </View>
    </>
  );
}
