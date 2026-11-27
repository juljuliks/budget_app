import React, { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import Button, { SheetActions } from './Button';
import { colors } from '../theme/theme';
import { font, space, weight } from '../theme/tokens';
import { SAVE_FAILED } from '../lib/strings';
import { toastFailure } from './toast';

// Confirmations and messages as bottom sheets, called like Alert.alert. <SheetAlertHost /> (mounted once in App)
// shows them.

/** 'secondary': outlined, for the less usual choice next to a filled one */
export type SheetButton = {
  text: string;
  style?: 'cancel' | 'destructive' | 'secondary' | 'default';
  /** may be async: what it doesn't catch is logged and said in a red toast */
  onPress?: () => void | Promise<void>;
};

/** A button's handler, run: an async one's failure is not lost. */
const press = (b?: SheetButton) => {
  Promise.resolve(b?.onPress?.()).catch(toastFailure(`"${b?.text}"`, SAVE_FAILED));
};
/** under the message, above the buttons (e.g. a note with a link); `close` closes the sheet first */
export type SheetExtra = (close: () => void) => ReactNode;
type Request = { title: string; message?: string; buttons: SheetButton[]; question?: string; extra?: SheetExtra };

let show: ((r: Request) => void) | null = null;

/**
 * Like Alert.alert(title, message, buttons): a sheet with the buttons stacked, the cancel one last. `question`: what
 * the buttons answer, in bold after the message; `extra`: something more under it.
 */
export function sheetAlert(
  title: string,
  message?: string,
  buttons: SheetButton[] = [{ text: 'Понятно' }],
  question?: string,
  extra?: SheetExtra,
) {
  show?.({ title, message, buttons, question, extra });
}

export function SheetAlertHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    show = (r) => {
      setReq(r);
      setVisible(true);
    };
    return () => {
      show = null;
    };
  }, []);

  const close = () => setVisible(false);
  const actions = (req?.buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (req?.buttons ?? []).find((b) => b.style === 'cancel');

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        close();
        press(cancel);
      }}
      title={req?.title}
    >
      <View style={styles.body}>
        {req?.message || req?.question ? (
          <Text style={styles.message}>
            {req.message ?? ''}
            {req.question ? (
              <Text style={styles.question}>
                {req.message ? ' ' : ''}
                {req.question}
              </Text>
            ) : null}
          </Text>
        ) : null}
        {req?.extra?.(close)}
        {/* the same buttons as every sheet (SheetActions): 'primary', 'secondary' for 'secondary', red for 'destructive' */}
        {actions.map((b) => (
          <Button
            key={b.text}
            title={b.text}
            danger={b.style === 'destructive'}
            variant={b.style === 'secondary' ? 'secondary' : 'primary'}
            onPress={() => {
              close();
              press(b);
            }}
          />
        ))}
        {cancel ? (
          <SheetActions
            submit={null}
            cancelTitle={cancel.text}
            onCancel={() => {
              close();
              press(cancel);
            }}
            style={styles.cancelRow}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space[20], gap: space[10] },
  message: { fontSize: font.body, color: colors.text, lineHeight: 21, marginBottom: space[6] },
  question: { fontWeight: weight.semibold },
  cancelRow: { marginTop: 0 },
});
