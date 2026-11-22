import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MenuButton } from '@/features/settings';
import Button from '@/shared/ui/Button';

/** The tab header's right: «Готово» while selecting several (leaves it), and the menu ⋮. */
export default function HeaderActions({ selecting, onDone }: { selecting: boolean; onDone: () => void }) {
  return (
    <View style={styles.headerRight}>
      {selecting ? <Button title="Готово" onPress={onDone} variant="primary" size="small" /> : null}
      <MenuButton />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 },
});
