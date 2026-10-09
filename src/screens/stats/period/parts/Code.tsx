import React from 'react';
import { Text } from 'react-native';
import { styles } from './styles';

/** A calculation inside the explanation text: monospace on a tinted background. */
export default function Code({ children }: { children: React.ReactNode }) {
  return <Text style={styles.code}>{children}</Text>;
}
