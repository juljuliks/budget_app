import React from 'react';
import { Text } from 'react-native';
import type { Mark } from '../model/marks';
import { styles } from './styles';

/** How a plan row is going, a line under its note: muted, "✓ …" green, past the plan orange. */
export default function RowMark({ mark }: { mark: Mark | null | undefined }) {
  if (!mark) return null;
  return <Text style={[styles.mark, mark.tone === 'ok' && styles.markOk, mark.tone === 'warn' && styles.markWarn]}>{mark.text}</Text>;
}
