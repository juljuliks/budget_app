import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Segmented from '@/shared/ui/Segmented';
import { colors } from '@/shared/theme/theme';
import AppTab from './parts/AppTab';
import BanksTab from './parts/BanksTab';
import BudgetTab from './parts/BudgetTab';

type Tab = 'budget' | 'banks' | 'app';
const TABS = [['budget', 'Бюджет'], ['banks', 'Банки'], ['app', 'Приложение']] as const;

/**
 * Настройки (⋮ in the tab headers): a page (back — the arrow in its header) with tabs, on «Бюджет» when opened, the
 * picked one kept until the page is closed. «Бюджет» — the currency, the limit notifications; «Банки» — the banks,
 * the message templates, importing SMS; «Приложение» — the lock, the backup, the version. The pages open over it, the
 * sheets (import, backup, the lock) — on it.
 */
export default function SettingsScreen() {
  const open = useIsFocused();
  const [tab, setTab] = useState<Tab>('budget');
  return (
    <ScrollView style={styles.page}>
      <Segmented options={TABS} value={tab} onChange={setTab} style={styles.tabs} />
      {tab === 'budget' ? <BudgetTab open={open} /> : tab === 'banks' ? <BanksTab /> : <AppTab open={open} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  tabs: { marginHorizontal: 16, marginTop: 12, marginBottom: 12 },
});
