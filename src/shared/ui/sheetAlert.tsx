import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import Button, { SheetActions } from './Button';
import { colors } from '../theme/theme';

// Confirmations and messages as bottom sheets, called like Alert.alert. <SheetAlertHost /> (mounted once in App)
// shows them.

/** 'secondary': outlined, for the less usual choice next to a filled one */
export type SheetButton = { text: string; style?: 'cancel' | 'destructive' | 'secondary' | 'default'; onPress?: () => void };
type Request = { title: string; message?: string; buttons: SheetButton[]; question?: string };

let show: ((r: Request) => void) | null = null;

/**
 * Like Alert.alert(title, message, buttons): a sheet with the buttons stacked, the cancel one last. `question`: what
 * the buttons answer, in bold after the message.
 */
export function sheetAlert(title: string, message?: string, buttons: SheetButton[] = [{ text: 'Понятно' }], question?: string) {
  show?.({ title, message, buttons, question });
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
        {req?.message || req?.question ? (
          <Text style={styles.message}>
            {req.message ?? ''}
            {req.question ? <Text style={styles.question}>{req.message ? ' ' : ''}{req.question}</Text> : null}
          </Text>
        ) : null}
        {/* the same buttons as every sheet (SheetActions): filled, outlined for 'secondary', red for 'destructive' */}
        {actions.map((b) => (
          <Button
            key={b.text}
            title={b.text}
            danger={b.style === 'destructive'}
            outline={b.style === 'secondary'}
            onPress={() => { close(); b.onPress?.(); }}
          />
        ))}
        {cancel ? <SheetActions submit={null} cancelTitle={cancel.text} onCancel={() => { close(); cancel.onPress?.(); }} style={styles.cancelRow} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 10 },
  message: { fontSize: 15, color: colors.text, lineHeight: 21, marginBottom: 6 },
  question: { fontWeight: '600' },
  cancelRow: { marginTop: 0 },
});
