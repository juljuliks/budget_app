// Opened not from the tab bar or the period list (a day of the operations, «Итоги 2026» of «История по месяцам»):
// a back arrow in the header and the hardware back return there; the tab pressed — a normal visit.
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HeaderBackButton } from '@react-navigation/elements';
import { backToPages, forgetPages, navigationRef, TabParamList } from '@/shared/navigation/navigation';

type StatsNavigation = BottomTabNavigationProp<TabParamList, 'Stats'>;

/** `reset`: back to the usual stats (the month) for the next visit. */
export function useStatsBack(reset: () => void) {
  const navigation = useNavigation<StatsNavigation>();
  const from = useRoute<RouteProp<TabParamList, 'Stats'>>().params?.from;
  const cb = useRef({ reset });
  cb.current = { reset };

  const goBack = useCallback(() => {
    navigation.setParams({ from: undefined, day: undefined, year: undefined });
    cb.current.reset();
    if (from === 'pages') {
      if (!backToPages()) navigation.navigate('Stats');
    } else if (from === 'Stats' || from === 'Transactions') navigation.navigate(from);
    else if (from) navigationRef.navigate(from as never);
  }, [navigation, from]);

  useFocusEffect(
    useCallback(() => {
      if (!from) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [from, goBack]),
  );

  // the tab pressed: a normal visit, no way back
  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (from) {
          navigation.setParams({ from: undefined });
          forgetPages();
        }
      }),
    [navigation, from],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: from ? () => <HeaderBackButton onPress={goBack} accessibilityLabel="Назад" /> : undefined,
    });
  }, [navigation, from, goBack]);
}
