import React from 'react';
import { Switch } from 'react-native';
import { colors } from '../theme/theme';

/** The app's switch: accent when on, named for tests and screen readers. */
export default function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: colors.accent, false: colors.border }}
      thumbColor={colors.white}
      accessibilityLabel={label}
    />
  );
}
