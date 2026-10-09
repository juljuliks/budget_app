import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { limitAlertsEnabled, setLimitAlertsEnabled } from '../limitAlerts';
import BottomSheet from '@/shared/ui/BottomSheet';
import { setDisplayCurrency, useDisplayCurrency } from '../displayCurrency';
import { useRootNavigation } from '@/shared/navigation/navigation';
import CurrencyPicker from '@/shared/ui/CurrencyPicker';
import { startSmsImport } from './smsImportFlow';
import { colors } from '@/shared/theme/theme';

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Настройки (the gear in the tab headers): a sheet with Валюта — the currency the app converts amounts to, switched right
 * here — the limit notifications switch, then Мерчанты, Категории and Импорт SMS (past bank SMS from the phone).
 */
export default function SettingsSheet({ open, onClose }: Props) {
  const navigation = useRootNavigation();
  const currency = useDisplayCurrency();
  const go = (route: 'Merchants' | 'Categories') => { onClose(); navigation.navigate(route); };
  const [alerts, setAlerts] = useState(true);
  useEffect(() => {
    if (open) limitAlertsEnabled().then(setAlerts).catch((e) => console.error('load limit alerts setting failed', e));
  }, [open]);
  const toggleAlerts = (on: boolean) => {
    setAlerts(on);
    setLimitAlertsEnabled(on).catch((e) => console.error('save limit alerts setting failed', e));
  };

  return (
    <BottomSheet visible={open} title="Настройки" onClose={onClose}>
      <View style={styles.currency}>
        <Text style={styles.label}>Валюта</Text>
        <Text style={styles.hint}>
          Статистика, план, история и суммы за день пересчитываются в неё по курсу Нацбанка Грузии. Операции
          остаются в своей валюте.
        </Text>
        <CurrencyPicker value={currency} onChange={(c) => { setDisplayCurrency(c).catch((e) => console.error('save currency failed', e)); }} />
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
      <Row label="Мерчанты" onPress={() => go('Merchants')} />
      <Row label="Категории" onPress={() => go('Categories')} />
      {/* after this sheet has closed: one sheet at a time */}
      <Row label="Импорт SMS из телефона" onPress={() => { onClose(); setTimeout(startSmsImport, 250); }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
});
