import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import BottomSheet from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { toastError } from '@/shared/ui/toast';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import {
  ENTER_PASSWORD, ENTER_PASSWORD_INFO, MIN_PASSWORD, PASSWORD, PASSWORD_FIELD, PASSWORD_MISMATCH, PASSWORD_REPEAT, PASSWORD_SHORT,
  SET_PASSWORD, SET_PASSWORD_INFO,
} from '../texts';

/** 'set': a new password and its confirmation; 'enter': the password of an encrypted copy being restored. */
type Mode = 'set' | 'enter';
type Ask = { mode: Mode; resolve: (password: string | null) => void };

let show: ((a: Ask) => void) | null = null;

/** Asks for a password in a sheet; null when cancelled. Called from the backup's flows, like sheetAlert. */
export function askPassword(mode: Mode): Promise<string | null> {
  return new Promise((resolve) => (show ? show({ mode, resolve }) : resolve(null)));
}

/** The sheet askPassword shows; mounted once (app/ModalHost). */
export function PasswordHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [password, setPasswordText] = useState('');
  const [repeat, setRepeat] = useState('');

  useEffect(() => {
    show = (a) => { setPasswordText(''); setRepeat(''); setAsk(a); };
    return () => { show = null; };
  }, []);

  const close = (value: string | null) => { ask?.resolve(value); setAsk(null); };
  const submit = () => {
    if (ask?.mode === 'set') {
      if (password.length < MIN_PASSWORD) return toastError(PASSWORD_SHORT);
      if (password !== repeat) return toastError(PASSWORD_MISMATCH);
    }
    close(password);
  };
  const field = (value: string, onChange: (v: string) => void, placeholder: string, last: boolean) => (
    <TextInput
      style={formStyles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType={last ? 'done' : 'next'}
      onSubmitEditing={last ? submit : undefined}
      accessibilityLabel={placeholder}
    />
  );

  const setting = ask?.mode === 'set';
  return (
    <BottomSheet visible={ask !== null} onClose={() => close(null)} title={setting ? PASSWORD : ENTER_PASSWORD}>
      <View style={styles.body}>
        <Text style={styles.hint}>{setting ? SET_PASSWORD_INFO : ENTER_PASSWORD_INFO}</Text>
        {field(password, setPasswordText, PASSWORD_FIELD, !setting)}
        {setting ? field(repeat, setRepeat, PASSWORD_REPEAT, true) : null}
        <SheetActions submit={{ title: setting ? SET_PASSWORD : 'Открыть', onPress: submit, disabled: password.length === 0 }} onCancel={() => close(null)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  hint: { fontSize: 14, color: colors.muted },
});
