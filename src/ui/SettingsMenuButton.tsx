import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRootNavigation } from '../navigation';
import { GearIcon } from './icons';
import { colors } from './theme';

// a heading groups the items under it (indented)
type Item = { heading: string } | { route: 'Merchants' | 'Categories' | 'CategoryTypes'; label: string; sub?: boolean };
const ITEMS: Item[] = [
  { route: 'Merchants', label: 'Мерчанты' },
  { heading: 'Категории' },
  { route: 'Categories', label: 'Категории', sub: true },
  { route: 'CategoryTypes', label: 'Типы', sub: true },
];

/** Gear in the tab headers: a small menu with the merchants, categories and category types screens. */
export default function SettingsMenuButton() {
  const navigation = useRootNavigation();
  const [open, setOpen] = useState(false);
  // one child for the header row: an open Modal is a view of its own on Android and would take a gap there,
  // shifting the header's buttons
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={10} style={styles.button} accessibilityLabel="Настройки">
        <GearIcon color={colors.accent} size={22} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Закрыть">
          <View style={styles.menu}>
            {ITEMS.map((it) => ('heading' in it ? (
              <Text key={it.heading} style={styles.heading}>{it.heading}</Text>
            ) : (
              <TouchableOpacity key={it.route} style={[styles.item, it.sub && styles.sub]} onPress={() => { setOpen(false); navigation.navigate(it.route); }}>
                <Text style={styles.itemText}>{it.label}</Text>
              </TouchableOpacity>
            )))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 4, paddingVertical: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  // under the header, at the right edge where the gear is
  menu: {
    position: 'absolute', top: 56, right: 12, minWidth: 180, backgroundColor: colors.bg, borderRadius: 10,
    paddingVertical: 6, elevation: 6,
  },
  item: { paddingHorizontal: 18, paddingVertical: 12 },
  sub: { paddingLeft: 30 },
  heading: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  itemText: { fontSize: 16, color: colors.text },
});
