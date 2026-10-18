import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { appVersion } from '@/native/appInfo';
import { limitAlertsEnabled, setLimitAlertsEnabled } from '@/notifications/limitAlerts';
import { setDisplayCurrency, useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { useRootNavigation } from '@/shared/navigation/navigation';
import { openBackup, openLockOptions } from '@/shared/navigation/sheets';
import { LockSettings } from '@/features/app-lock';
import { startSmsImport } from '@/features/sms-import';
import CurrencyPicker from '@/shared/ui/CurrencyPicker';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED, SAVE_FAILED } from '@/shared/lib/strings';

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

/**
 * Настройки (the gear in the tab headers): a page (back — the arrow in its header) with Валюта — the currency the app converts amounts to, switched right
 * here — the limit notifications switch, «Блокировка», then Банки, Мерчанты, Категории, Шаблоны сообщений, Импорт SMS (past bank SMS from the phone) and
 * Резервная копия; the installed version at the bottom. The pages open over it, the sheets (import, backup, the lock) — on it.
 */
export default function SettingsScreen() {
  const navigation = useRootNavigation();
  const open = useIsFocused();
  const currency = useDisplayCurrency();
  const go = (route: 'Merchants' | 'Categories' | 'MessageTemplates' | 'Banks') => navigation.navigate(route);
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
    <ScrollView style={styles.page}>
        <View style={styles.currency}>
          <Text style={styles.label}>Валюта</Text>
          <Text style={styles.hint}>
            Статистика, план, история и суммы за день пересчитываются в неё по курсу Нацбанка Грузии. Операции
            остаются в своей валюте.
          </Text>
          <CurrencyPicker value={currency} onChange={(c) => { setDisplayCurrency(c).catch(toastFailure('save currency', SAVE_FAILED)); }} />
        </View>
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
        <LockSettings open={open} onOptions={openLockOptions} />
        <Row label="Банки" onPress={() => go('Banks')} />
        <Row label="Мерчанты" onPress={() => go('Merchants')} />
        <Row label="Категории" onPress={() => go('Categories')} />
        <Row label="Шаблоны сообщений" onPress={() => go('MessageTemplates')} />
        <Row label="Импорт SMS из телефона" onPress={startSmsImport} />
        <Row label="Резервная копия" onPress={openBackup} />
        {/* which build is installed: the phone's and the emulator's can differ */}
        <Text style={styles.version}>Версия {appVersion()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 10 },
  currency: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  flex: { flex: 1 },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  label: { fontSize: 16, color: colors.text },
  chevron: { fontSize: 20, color: colors.muted, width: 20, textAlign: 'right' },
  version: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
