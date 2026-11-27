import React, { ReactNode, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { formStyles } from '../theme/formStyles';
import { colors } from '../theme/theme';
import { font, radius, space, weight } from '../theme/tokens';

type Props = Omit<TextInputProps, 'style'> & {
  /** over the field, in capitals ("СУММА") */
  label?: string;
  /** under the field, grey */
  hint?: string | null;
  /** under the field, red (instead of the hint) */
  error?: string | null;
  /** an amount: the decimal keyboard, "0.00", up to 12 characters, even digits */
  amount?: boolean;
  /** the sheet's main amount: large and bold */
  large?: boolean;
  /** inside the field at the right: the currency's symbol ("₾") */
  suffix?: string;
  /** next to the field, as tall as it: the currency button */
  right?: ReactNode;
  /** a field inside a row (a split, a month's answer): a little lower */
  compact?: boolean;
  /** margins and width of the whole field */
  style?: StyleProp<ViewStyle>;
  /** the text itself: a multiline's height, a right-aligned amount's width */
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * A text field of a form: its label, the field (its border in the accent while typing), a hint or an error under it.
 * An amount — `amount`, its currency as a symbol inside (`suffix`) or a button next to it (`right`).
 */
export default function TextField({
  label,
  hint,
  error,
  amount,
  large,
  suffix,
  right,
  compact,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...input
}: Props) {
  const [focus, setFocus] = useState(false);
  const amountProps: TextInputProps = amount ? { keyboardType: 'decimal-pad', maxLength: 12, placeholder: '0.00' } : {};
  return (
    <View style={style}>
      {label ? <Text style={formStyles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={[styles.box, focus && styles.focus]}>
          <TextInput
            placeholderTextColor={colors.muted}
            {...amountProps}
            {...input}
            style={[
              styles.input,
              compact && styles.compact,
              amount && styles.digits,
              large && styles.large,
              inputStyle,
            ]}
            onFocus={(e) => {
              setFocus(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocus(false);
              onBlur?.(e);
            }}
          />
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
        {right}
      </View>
      {error ? (
        <Text style={[formStyles.hint, styles.error]}>{error}</Text>
      ) : hint ? (
        <Text style={formStyles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // stretch: the button at the right as tall as the field
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space[8] },
  box: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[6],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    paddingHorizontal: space[12],
  },
  focus: { borderColor: colors.accent },
  // no padding of Android's own at the sides: the box's
  input: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: font.input,
    color: colors.text,
    paddingVertical: space[10],
    paddingHorizontal: 0,
  },
  compact: { paddingVertical: space[8] },
  digits: { fontVariant: ['tabular-nums'] },
  large: { fontSize: font.headline, fontWeight: weight.semibold },
  suffix: { fontSize: font.body, color: colors.muted },
  error: { color: colors.danger },
});
