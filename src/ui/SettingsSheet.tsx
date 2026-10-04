import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { setDisplayCurrency, useDisplayCurrency } from '../displayCurrency';
import { useRootNavigation } from '../navigation';
import CurrencyPicker from './CurrencyPicker';
import { startSmsImport } from './smsImportFlow';
import { colors } from './theme';

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
 * here — then Мерчанты, Категории and Импорт SMS (past bank SMS from the phone).
 */
export default function SettingsSheet({ open, onClose }: Props) {
  const navigation = useRootNavigation();
  const currency = useDisplayCurrency();
  const go = (route: 'Merchants' | 'Categories') => { onClose(); navigation.navigate(route); };

  return (
    <BottomSheet visible={open} title="Настройки" onClose={onClose}>
      <View style={styles.currency}>
        <Text style={styles.label}>Валюта</Text>
        <Text style={styles.hint}>
          Статистика, план, история и суммы за день пересчитываются в неё по курсу Нацбанка Грузии. Транзакции
          остаются в своей валюте.
        </Text>
        <CurrencyPicker value={currency} onChange={(c) => { setDisplayCurrency(c).catch((e) => console.error('save currency failed', e)); }} />
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
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  label: { fontSize: 16, color: colors.text },
  chevron: { fontSize: 20, color: colors.muted, width: 20, textAlign: 'right' },
});
