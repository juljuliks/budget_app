import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import Toggle from './Toggle';
import { useLockState } from '../model/useLockState';
import { disableLock, enableLock } from '../model/commands';
import { LOCK, LOCK_BIO_HINT, LOCK_OFF_HINT, LOCK_PIN_HINT, SET_UP } from '../texts';

/**
 * "Блокировка" in the settings: its switch (on — a PIN twice right away; off — after the PIN) and, while on,
 * "Настроить" — the lock's sheet (`onOptions`: the app closes the settings and opens it).
 */
export default function LockSettings({ open, onOptions }: { open: boolean; onOptions: () => void }) {
  const { s, run } = useLockState(open);
  if (!s) return null;
  const hint = !s.pin ? LOCK_OFF_HINT : s.biometric ? LOCK_BIO_HINT : LOCK_PIN_HINT;
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{LOCK}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {s.pin ? (
          <TouchableOpacity onPress={onOptions} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{SET_UP}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Toggle label={LOCK} value={s.pin} onChange={(on) => run(on ? enableLock() : disableLock())} />
    </View>
  );
}

// as the backup's switches (features/backup SwitchRow)
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 16, color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  link: { fontSize: 14, color: colors.accent, marginTop: 6 },
});
