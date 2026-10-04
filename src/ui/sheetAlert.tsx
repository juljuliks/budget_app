import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { colors } from './theme';

// Confirmations and messages as bottom sheets, called like Alert.alert. <SheetAlertHost /> (mounted once in App)
// shows them.

export type SheetButton = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };
type Request = { title: string; message?: string; buttons: SheetButton[] };

let show: ((r: Request) => void) | null = null;

/** Like Alert.alert(title, message, buttons): a sheet with the buttons stacked, the cancel one last. */
export function sheetAlert(title: string, message?: string, buttons: SheetButton[] = [{ text: 'OK' }]) {
  show?.({ title, message, buttons });
}

export function SheetAlertHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    show = (r) => { setReq(r); setVisible(true); };
    return () => { show = null; };
  }, []);

  const close = () => setVisible(false);
  const actions = (req?.buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (req?.buttons ?? []).find((b) => b.style === 'cancel');

  return (
    <BottomSheet visible={visible} onClose={() => { close(); cancel?.onPress?.(); }} title={req?.title}>
      <View style={styles.body}>
        {req?.message ? <Text style={styles.message}>{req.message}</Text> : null}
        {actions.map((b) => (
          <TouchableOpacity
            key={b.text}
            style={[styles.button, b.style === 'destructive' ? styles.danger : styles.primary]}
            onPress={() => { close(); b.onPress?.(); }}
          >
            <Text style={styles.buttonText}>{b.text}</Text>
          </TouchableOpacity>
        ))}
        {cancel ? (
          <TouchableOpacity style={styles.cancel} onPress={() => { close(); cancel.onPress?.(); }}>
            <Text style={styles.cancelText}>{cancel.text}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 10 },
  message: { fontSize: 15, color: colors.text, lineHeight: 21, marginBottom: 6 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primary: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.danger },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 16, color: colors.muted },
});
