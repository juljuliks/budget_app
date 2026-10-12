import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { setHideAmounts, useHideAmounts } from '@/shared/settings/hideAmounts';
import { EyeIcon, EyeOffIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { SAVE_FAILED } from '@/shared/lib/strings';

/**
 * The eye next to the gear in the stats header: blurs the budget and plan totals (see Masked). Hiding is at once;
 * showing — after `confirmShow` (the PIN or the fingerprint when the lock is on).
 */
export default function HideAmountsButton({ confirmShow }: { confirmShow: () => Promise<boolean> }) {
  const hidden = useHideAmounts();
  const save = (v: boolean) => setHideAmounts(v).catch(toastFailure('save hide amounts', SAVE_FAILED));
  const press = () => {
    if (!hidden) { save(true); return; }
    confirmShow().then((ok) => { if (ok) save(false); }).catch(toastFailure('confirm show amounts', SAVE_FAILED));
  };
  return (
    <TouchableOpacity
      onPress={press}
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
