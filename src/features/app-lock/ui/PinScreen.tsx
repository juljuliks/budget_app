import React, { useEffect, useState } from 'react';
import { Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/shared/ui/Button';
import { CloseIcon, LockIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import Keypad from './Keypad';
import { MAX_PIN, MIN_PIN, NEXT } from '../texts';

export type PinScreenProps = {
  /** a window's name, with ✕ (cancel); none: the lock screen (the lock icon, no way around) */
  title?: string;
  heading: string;
  hint?: string;
  /** the PIN's length, checked once typed; null: a new one, 4–6 digits and "Дальше" */
  length: number | null;
  error?: string;
  disabled?: boolean;
  /** changes → the digits typed are cleared */
  resetKey: number;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
  onBiometric?: () => void;
  /** a link under the error: "Придумать заново", "Забыли PIN-код?" */
  link?: { title: string; onPress: () => void };
};

/** A full-screen window for the PIN: over every sheet (a Modal shown later is on top). */
export default function PinScreen({ visible, ...p }: PinScreenProps & { visible: boolean }) {
  const [pin, setPinText] = useState('');
  useEffect(() => { setPinText(''); }, [p.resetKey, p.heading, visible]);

  const type = (d: string) => {
    if (pin.length >= (p.length ?? MAX_PIN)) return;
    const next = pin + d;
    setPinText(next);
    if (p.length !== null && next.length === p.length) p.onSubmit(next);
  };
  const dots = Math.max(p.length ?? MIN_PIN, pin.length);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => p.onCancel?.()} statusBarTranslucent>
      <View style={styles.screen}>
        {p.title ? (
          <View style={styles.header}>
            <TouchableOpacity onPress={p.onCancel} hitSlop={10} style={styles.close} accessibilityLabel="Отмена">
              <CloseIcon color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{p.title}</Text>
          </View>
        ) : (
          <View style={styles.badge}><LockIcon color={colors.accent} size={30} /></View>
        )}
        <View style={styles.body}>
          <Text style={styles.heading}>{p.heading}</Text>
          {p.hint ? <Text style={styles.hint}>{p.hint}</Text> : null}
          <View style={styles.dots} accessibilityLabel={`Введено цифр: ${pin.length}`}>
            {Array.from({ length: dots }, (_, i) => <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />)}
          </View>
          <Text style={styles.error}>{p.error ?? ''}</Text>
          {p.link ? (
            <TouchableOpacity onPress={p.link.onPress} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{p.link.title}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Keypad onDigit={type} onErase={() => setPinText(pin.slice(0, -1))} onBiometric={p.onBiometric} disabled={p.disabled} />
        <View style={styles.footer}>
          {p.length === null ? <Button title={NEXT} onPress={() => p.onSubmit(pin)} disabled={pin.length < MIN_PIN} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: StatusBar.currentHeight ?? 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  close: { padding: 8 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  badge: {
    alignSelf: 'center', marginTop: 48, width: 64, height: 64, borderRadius: 18, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, gap: 14 },
  heading: { fontSize: 22, fontWeight: '600', color: colors.text },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 14, height: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#9CA3AF' },
  dotOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  error: { fontSize: 14, color: colors.danger, textAlign: 'center', minHeight: 20 },
  link: { fontSize: 15, fontWeight: '600', color: colors.accent, padding: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, minHeight: 76 },
});
