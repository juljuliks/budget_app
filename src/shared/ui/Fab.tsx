import React from 'react';
import { StyleSheet } from 'react-native';
import PlusButton from './PlusButton';

/** The floating "+" pinned to the bottom right corner: the app's PlusButton, 48 across. */
export default function Fab({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  return <PlusButton onPress={onPress} accessibilityLabel={accessibilityLabel} size={48} style={styles.fab} />;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 16, elevation: 4 },
});
