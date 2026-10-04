import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setDisplayCurrency, useDisplayCurrency } from '../displayCurrency';
import { useRootNavigation } from '../navigation';
import CurrencyPicker from './CurrencyPicker';
import { colors } from './theme';

/** A sheet sliding up from the bottom, closed by tapping outside it or the back button. */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

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
 * Настройки (the tab bar's gear): a sheet with Валюта — the currency the app converts amounts to, switched right
 * here — then Мерчанты and Категории.
 */
export default function SettingsSheet({ open, onClose }: Props) {
  const navigation = useRootNavigation();
  const currency = useDisplayCurrency();
  const go = (route: 'Merchants' | 'Categories') => { onClose(); navigation.navigate(route); };

  return (
    <Sheet visible={open} title="Настройки" onClose={onClose}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
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
