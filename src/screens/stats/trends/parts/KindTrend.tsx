import React, { useMemo } from 'react';
import { formatWithCurrency } from '@/shared/lib/money';
import Loading from '@/shared/ui/Loading';
import { fundTrend, subsTrend } from '@/stats/subsFundTrend';
import { rareTrend } from '@/stats/trendKind';
import type { CategoryTrendView } from '../model/categoryTrendView';
import type { KindData } from '../model/useKindTrend';
import FundTrend from './FundTrend';
import RareTrend from './RareTrend';
import SubsTrend from './SubsTrend';

/** A category's «Динамика» that isn't of frequent spending: a rare one's, subscriptions', a fund's. */
export default function KindTrend({ v, data, today, money }: {
  v: NonNullable<CategoryTrendView>; data: KindData | null; today: string; money: (minor: number) => string;
}) {
  const rare = useMemo(() => (v.kind === 'rare' ? rareTrend(v.spends, today) : null), [v, today]);
  if (rare) return <RareTrend r={rare} bars={v.months} color={v.category.color} categoryId={v.category.id} money={money} />;
  if (data?.kind === 'subs') {
    return <SubsTrend t={subsTrend(data.payments, v.spends, today)} next={data.next} bars={v.months} color={v.category.color} money={money} />;
  }
  if (data?.kind === 'fund') {
    const f = fundTrend(data.fund, data.ledger.months, data.ledger.balance, v.spends, today);
    return <FundTrend f={f} categoryId={v.category.id} label={v.label} money={(m) => formatWithCurrency(Math.round(Math.abs(m)), data.fund.currency)} />;
  }
  return <Loading inline />;
}
