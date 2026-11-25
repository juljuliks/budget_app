import React from 'react';
import { StyleSheet } from 'react-native';
import { space } from '../theme/tokens';
import Banner from './Banner';

type Props = {
  /** what is going on: sorting out a category being deleted, picking an operation for a payment */
  text: string;
  onCancel: () => void;
  /** the banner is `<id>-banner`, its "Отменить" `<id>-cancel` */
  testID?: string;
};

/** A mode a list is in, over its filters, and "Отменить" to leave it. */
export default function ModeBanner({ text, onCancel, testID }: Props) {
  return (
    <Banner
      title={text}
      action={{ label: 'Отменить', onPress: onCancel, danger: true, testID: testID ? `${testID}-cancel` : undefined }}
      style={styles.banner}
      testID={testID ? `${testID}-banner` : undefined}
    />
  );
}

const styles = StyleSheet.create({ banner: { marginBottom: space[8] } });
