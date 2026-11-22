import React, { useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MonthReportPage, reportTitle } from '@/features/month-report';
import type { RootStackParamList } from '@/shared/navigation/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'MonthReport'>;

/** «Отчёт · Октябрь 2026»: a month's report as a page. */
export default function MonthReportScreen({ route, navigation }: Props) {
  const { ym } = route.params;
  useLayoutEffect(() => { navigation.setOptions({ title: `Отчёт · ${reportTitle(ym)}` }); }, [navigation, ym]);
  return <MonthReportPage ym={ym} />;
}
