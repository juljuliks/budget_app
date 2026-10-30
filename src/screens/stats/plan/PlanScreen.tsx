import React, { useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseYm } from '@/db/plans';
import { monthTitle } from '@/shared/lib/dates';
import type { RootStackParamList } from '@/shared/navigation/navigation';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import PlanView from './PlanView';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

/**
 * A month's plan, a page over the stats («Изменить план ›», «Составить план ›»; the next month — its empty stats):
 * «План · Октябрь 2026» its title, no arrows — the month is the stats'.
 */
export default function PlanScreen({ route, navigation }: Props) {
  const { ym } = route.params;
  const currency = useDisplayCurrency();
  useLayoutEffect(() => {
    const { year, month } = parseYm(ym);
    navigation.setOptions({ title: `План · ${monthTitle(year, month)}` });
  }, [navigation, ym]);
  return <PlanView key={ym} ym={ym} currency={currency} />;
}
