import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { setHideAmounts, useHideAmounts } from '../hideAmounts';
import { EyeIcon, EyeOffIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';

/** The eye next to the gear in the stats header: blurs the budget and plan totals (see Masked). */
export default function HideAmountsButton() {
  const hidden = useHideAmounts();
  return (
    <TouchableOpacity
      onPress={() => { setHideAmounts(!hidden).catch((e) => console.error('save hide amounts failed', e)); }}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="switch"
      accessibilityState={{ checked: hidden }}
      accessibilityLabel={hidden ? 'Показать суммы бюджета' : 'Скрыть суммы бюджета'}
    >
      {hidden ? <EyeOffIcon color={colors.accent} /> : <EyeIcon color={colors.accent} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
