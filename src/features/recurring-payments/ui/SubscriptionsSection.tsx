import React, { useEffect, useState } from 'react';
import { Category, getCategory, isSubscriptions } from '@/db/categories';
import CategorySubscriptions from './CategorySubscriptions';

/**
 * A category's page: under "📺 Подписки" (the system one) — its subscriptions and its merchants without one; nothing on
 * any other category (subscriptions are only there).
 */
export default function SubscriptionsSection({ categoryId }: { categoryId: number }) {
  const [c, setC] = useState<Category | null>(null);
  useEffect(() => {
    getCategory(categoryId).then((x) => setC(x ?? null)).catch((e) => console.error('load category failed', e));
  }, [categoryId]);
  if (!c || !isSubscriptions(c)) return null;
  return <CategorySubscriptions category={{ id: c.id, name: c.name, emoji: c.emoji }} />;
}
