import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from '@/shared/ui/BottomSheet';
import Segmented from '@/shared/ui/Segmented';
import { colors } from '@/shared/theme/theme';
import Toggle from './Toggle';
import { useLockState } from '../model/useLockState';
import { changePin, saveHideNotifications, saveLockDelay, switchBiometric } from '../model/commands';
import { BIOMETRIC, CHANGE_PIN, DELAY, DELAYS, HIDE_NOTIFICATIONS, HIDE_NOTIFICATIONS_HINT, LOCK } from '../texts';

/**
 * "Блокировка" (Настройки → "Настроить", while it is on): the fingerprint (when the phone has one), how soon to ask
 * after the app was left, the amounts hidden in the notifications, "Сменить PIN-код".
 */
export default function LockOptionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { s, run, set } = useLockState(visible);
  return (
    <BottomSheet visible={visible} title={LOCK} onClose={onClose}>
      {s ? (
        <View style={styles.body}>
          {s.biometricAvailable || s.biometric ? (
            <View style={styles.row}>
              <Text style={[styles.flex, styles.label]}>{BIOMETRIC}</Text>
              <Toggle label={BIOMETRIC} value={s.biometric} onChange={(on) => run(switchBiometric(on))} />
            </View>
          ) : null}
          <View style={styles.delay}>
            <Text style={styles.label}>{DELAY}</Text>
            <Segmented
              options={DELAYS}
              value={String(s.delayS)}
              onChange={(v) => { set({ delayS: Number(v) }); run(saveLockDelay(Number(v))); }}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>{HIDE_NOTIFICATIONS}</Text>
              <Text style={styles.hint}>{HIDE_NOTIFICATIONS_HINT}</Text>
            </View>
            <Toggle
              label={HIDE_NOTIFICATIONS}
              value={s.hideNotifications}
              onChange={(on) => { set({ hideNotifications: on }); run(saveHideNotifications(on)); }}
            />
          </View>
          <TouchableOpacity onPress={() => run(changePin())} hitSlop={8} accessibilityRole="button" style={styles.linkWrap}>
            <Text style={styles.link}>{CHANGE_PIN}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 18, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  label: { fontSize: 16, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  delay: { gap: 8 },
  linkWrap: { alignSelf: 'flex-start' },
  link: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
