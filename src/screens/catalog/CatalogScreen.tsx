import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { space } from '@/shared/theme/tokens';
import ActionsDemo from './parts/ActionsDemo';
import BoxesDemo from './parts/BoxesDemo';
import ChartsDemo from './parts/ChartsDemo';
import ChoiceDemo from './parts/ChoiceDemo';

/**
 * «Компоненты» (debug build only, from ⋮): every shared/ui component with its variants — the reference for a review
 * and for a design. A new component or variant gets a frame here (REFACTOR_PLAN.md, B4).
 */
export default function CatalogScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ActionsDemo />
      <ChoiceDemo />
      <BoxesDemo />
      <ChartsDemo />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space[48] },
});
