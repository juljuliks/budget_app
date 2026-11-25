import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { countUnparsed } from '@/db/messages';
import { onTransactionsChanged } from '@/domain/events';
import { useRootNavigation } from '@/shared/navigation/navigation';
import Banner from '@/shared/ui/Banner';
import { UNPARSED } from './texts';
import { space } from '@/shared/theme/tokens';

/** Over the operations: "Не распознано: N ›" while bank messages wait for marking; opens their list. */
export default function UnparsedBanner() {
  const navigation = useRootNavigation();
  const [n, setN] = useState(0);
  const load = useCallback(() => {
    countUnparsed()
      .then(setN)
      .catch((e) => console.error('count unparsed failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (n === 0) return null;
  return (
    <Banner
      title={`${UNPARSED}: ${n}`}
      text="Сообщения банка без операции — отметьте в них сумму"
      onPress={() => navigation.navigate('Unparsed')}
      style={styles.box}
    />
  );
}

const styles = StyleSheet.create({ box: { marginBottom: space[8] } });
