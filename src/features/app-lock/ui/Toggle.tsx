import React from 'react';
import { Switch } from 'react-native';
import { colors } from '@/shared/theme/theme';

/** A switch of the lock's settings, named for tests and screen readers. */
export default function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accent, false: colors.border }}
      thumbColor="#FFFFFF"
      accessibilityLabel={label}
    />
  );
}
