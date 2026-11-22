import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from '@/shared/ui/BottomSheet';
import { ChevronRightIcon, GearIcon, GridIcon, MoreIcon, StoreIcon } from '@/shared/ui/icons';
import { guardLeave } from '@/shared/navigation/leaveGuard';
import { navigationRef } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';

type Route = 'Categories' | 'Merchants' | 'Settings';
type Item = { route: Route; label: string; hint: string; icon: (color: string) => React.ReactNode };

const ITEMS: Item[] = [
  { route: 'Categories', label: 'Категории', hint: 'разделы, эмодзи, вид в плане', icon: (c) => <GridIcon color={c} size={24} /> },
  { route: 'Merchants', label: 'Мерчанты', hint: 'какая категория у какого магазина', icon: (c) => <StoreIcon color={c} size={24} /> },
  { route: 'Settings', label: 'Настройки', hint: 'бюджет, банки, приложение', icon: (c) => <GearIcon color={c} size={24} /> },
];

/** ⋮ in the tab headers: a sheet of the pages over the tabs — Категории, Мерчанты, Настройки (back — to the tab). */
export default function MenuButton() {
  const [open, setOpen] = useState(false);
  const go = (route: Route) => {
    setOpen(false);
    // in the middle of a sort-out the Operations tab asks first
    guardLeave(() => navigationRef.navigate(route));
  };
  return (
    // one element of the header's row: the sheet's modal inside it, not a neighbour (the row's gap would shift ⋮)
    <View>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={10} style={styles.button} accessibilityLabel="Меню">
        <MoreIcon color={colors.accent} size={22} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.list}>
          {ITEMS.map((it, i) => (
            <TouchableOpacity key={it.route} style={[styles.row, i > 0 && styles.divider]} onPress={() => go(it.route)} accessibilityRole="button">
              {it.icon(colors.accent)}
              <View style={styles.text}>
                <Text style={styles.label}>{it.label}</Text>
                <Text style={styles.hint}>{it.hint}</Text>
              </View>
              <ChevronRightIcon color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
  list: { paddingTop: 4, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  text: { flex: 1 },
  label: { fontSize: 17, color: colors.text },
  hint: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
