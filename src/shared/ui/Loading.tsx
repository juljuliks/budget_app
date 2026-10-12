import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LOAD_FAILED, RETRY } from '../lib/strings';
import { colors } from '../theme/theme';
import Button from './Button';

type Props = {
  /** the load failed (useLoadFailed): said, with "Повторить", instead of the spinner */
  failed?: boolean;
  onRetry?: () => void;
  /** in a row of a list (History's month), not over the whole screen */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** What a screen shows until its data comes: a spinner, or "Не удалось загрузить" and "Повторить". */
export default function Loading({ failed, onRetry, inline, style }: Props) {
  return (
    <View style={[inline ? styles.inline : styles.center, style]}>
      {failed ? (
        <>
          <Text style={styles.text}>{LOAD_FAILED}</Text>
          {onRetry ? <Button title={RETRY} onPress={onRetry} outline style={styles.retry} /> : null}
        </>
      ) : <ActivityIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  inline: { alignItems: 'center', paddingVertical: 10, gap: 8 },
  text: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  retry: { alignSelf: 'stretch', marginTop: 0 },
});
