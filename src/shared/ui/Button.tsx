import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { font, radius, space, weight } from '../theme/tokens';
import { SAVE_FAILED } from '../lib/strings';
import { toastFailure } from './toast';

/**
 * The app's three buttons — every button is one of them, no hand-made ones:
 * - `primary`: filled in the accent, white text — the main action ("Сохранить");
 * - `secondary`: white, the accent's border and text — another choice next to it ("Для мерчанта", "Повторить");
 * - `cancel`: white, a grey border and grey text — backing out, not an action ("Отмена", "Не сейчас");
 * - `text`: the title alone in the accent — a small action in a header, a toolbar or a card ("Сбросить все",
 *   "＋ Добавить описание"); `muted` — grey ("Не сейчас"). A link to another place is `TextLink` («… ›»).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'cancel' | 'text';

/** A button's action; an async one's failure is logged and said in a red toast ("Не удалось сохранить"). */
export type Press = () => void | Promise<void>;

type Props = {
  title: string;
  onPress: Press;
  /** 'primary' when not given */
  variant?: ButtonVariant;
  /** 'small': for a row of answers ("Да, 300 ₾", "Другая сумма", "Нет"), as wide as its text in a row */
  size?: 'regular' | 'small';
  disabled?: boolean;
  /** red instead of the accent, for deleting: filled or outlined as the variant says (not for `cancel`) */
  danger?: boolean;
  /** `text` only: grey, a quiet choice next to the main one ("Не сейчас") */
  muted?: boolean;
  /** an icon before the title, drawn in the title's color ("✎ Сменить") */
  icon?: (color: string) => React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** for the end-to-end flows (tests/e2e) */
  testID?: string;
};

function looks(
  variant: ButtonVariant,
  danger?: boolean,
  muted?: boolean,
): [StyleProp<ViewStyle>, StyleProp<TextStyle>] {
  if (variant === 'cancel') return [styles.cancel, styles.cancelText];
  const color = danger ? colors.danger : colors.accent;
  if (variant === 'text') return [styles.plain, [styles.plainText, { color: muted ? colors.muted : color }]];
  return variant === 'secondary'
    ? [
        [styles.secondary, { borderColor: color }],
        [styles.text, { color }],
      ]
    : [{ backgroundColor: color }, styles.text];
}

/** Full-width button ("Сохранить", "Удалить операцию", "Отмена"): `primary`, `secondary` or `cancel`; accent or red. */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled,
  danger,
  muted,
  icon,
  accessibilityLabel,
  style,
  testID,
}: Props) {
  const [box, text] = looks(variant, danger, muted);
  const plain = variant === 'text';
  const small = size === 'small';
  // a bordered one loses a point of padding to its border: as tall as a filled one
  const bordered = variant !== 'primary';
  const textColor = StyleSheet.flatten(text).color as string;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        box,
        small && !plain && (bordered ? styles.smallBordered : styles.small),
        icon && styles.withIcon,
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled}
      onPress={() => {
        Promise.resolve(onPress()).catch(toastFailure(`"${title}"`, SAVE_FAILED));
      }}
      hitSlop={plain ? 8 : undefined}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon?.(textColor)}
      <Text style={[text, small && (plain ? styles.plainSmall : styles.smallText)]}>{title}</Text>
    </TouchableOpacity>
  );
}

type SheetActionsProps = {
  /** the main action, full width; null = only "Отмена" (e.g. nothing changed yet) */
  submit: { title: string; onPress: Press; disabled?: boolean; danger?: boolean } | null;
  /** more actions under it, `secondary` */
  extra?: Array<{ title: string; onPress: Press; danger?: boolean }>;
  onCancel?: () => void;
  cancelTitle?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The buttons of every sheet, one look across the app: the main action `primary`, other choices `secondary` under it,
 * "Отмена" at the bottom — `cancel`.
 */
export function SheetActions({ submit, extra, onCancel, cancelTitle = 'Отмена', style }: SheetActionsProps) {
  return (
    <View style={[styles.actions, style]}>
      {submit ? (
        <Button title={submit.title} onPress={submit.onPress} disabled={submit.disabled} danger={submit.danger} />
      ) : null}
      {extra?.map((b) => (
        <Button key={b.title} title={b.title} onPress={b.onPress} danger={b.danger} variant="secondary" />
      ))}
      {onCancel ? <Button title={cancelTitle} onPress={onCancel} variant="cancel" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.md, paddingVertical: space[14], alignItems: 'center' },
  // white, not see-through (on a grey card too); the border takes a point of the padding: as tall as a primary one
  secondary: { backgroundColor: colors.bg, borderWidth: 1, paddingVertical: space[14] },
  cancel: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, paddingVertical: space[14] },
  small: { paddingHorizontal: space[14], paddingVertical: space[10] },
  smallBordered: { paddingHorizontal: space[14], paddingVertical: space[10] },
  smallText: { fontSize: font.body },
  withIcon: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
  disabled: { opacity: 0.5 },
  plain: { paddingVertical: 0, borderRadius: 0, alignItems: 'flex-start' },
  plainText: { fontSize: font.body },
  plainSmall: { fontSize: font.secondary },
  text: { color: colors.onAccent, fontSize: font.input, fontWeight: weight.semibold },
  cancelText: { fontSize: font.input, color: colors.muted },
  actions: { gap: space[10], marginTop: space[16] },
});
