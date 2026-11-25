import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { font, radius, space, weight } from '../theme/tokens';

export type BannerTone = 'warn' | 'info' | 'neutral' | 'ok';

type Props = {
  /** warn — yellow (something to do), info — blue (an offer), neutral — grey (a note), ok — green (all is well) */
  tone?: BannerTone;
  title?: string;
  text?: ReactNode;
  /** before the text: badges, an icon */
  left?: ReactNode;
  /** under the text: links, buttons */
  children?: ReactNode;
  /** the whole banner is a button, with › on the right */
  onPress?: () => void;
  /** a text button on the right ("Отменить") */
  action?: { label: string; onPress: () => void; danger?: boolean; testID?: string };
  /** ✕ on the right: what it does, for a screen reader ("Скрыть до завтра") */
  close?: { label: string; onPress: () => void };
  /** read out as it appears (a warning) */
  alert?: boolean;
  /** margins where it stands */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

const TONES = {
  warn: { bg: colors.warnBg, title: colors.warn, text: colors.warn },
  info: { bg: colors.accentBg, title: colors.text, text: colors.muted },
  neutral: { bg: colors.surface, title: colors.text, text: colors.muted },
  ok: { bg: colors.savingsBg, title: colors.income, text: colors.text },
} as const;

/** A box over a list or in a sheet: a warning, an offer, a note — title, text, links; ✕, › or a text button. */
export default function Banner({
  tone = 'warn',
  title,
  text,
  left,
  children,
  onPress,
  action,
  close,
  alert,
  style,
  testID,
  accessibilityLabel,
}: Props) {
  const t = TONES[tone];
  const body = (
    <>
      {left}
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: t.title }]}>{title}</Text> : null}
        {text ? <Text style={[styles.text, { color: t.text }]}>{text}</Text> : null}
        {children}
      </View>
      {onPress ? <Text style={[styles.chevron, { color: t.title }]}>›</Text> : null}
      {action ? (
        <TouchableOpacity
          style={styles.side}
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          testID={action.testID}
        >
          <Text style={[styles.action, action.danger && styles.danger]}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
      {close ? (
        <TouchableOpacity
          style={styles.top}
          onPress={close.onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={close.label}
        >
          <Text style={[styles.close, { color: t.title }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
  const box = [styles.box, { backgroundColor: t.bg }, style];
  const role = alert ? 'alert' : undefined;
  if (onPress) {
    return (
      <TouchableOpacity
        style={box}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return (
    <View style={box} accessibilityRole={role} accessibilityLabel={accessibilityLabel} testID={testID}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space[10], padding: space[12], borderRadius: radius.md },
  body: { flex: 1, gap: space[4] },
  title: { fontSize: font.body, fontWeight: weight.semibold },
  text: { fontSize: font.secondary },
  chevron: { fontSize: font.heading },
  side: { alignSelf: 'center' },
  action: { fontSize: font.secondary, color: colors.accent },
  danger: { color: colors.danger },
  top: { alignSelf: 'flex-start' },
  close: { fontSize: font.input },
});
