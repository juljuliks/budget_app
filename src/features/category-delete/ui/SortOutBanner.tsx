import React from 'react';
import type { Bucket } from '@/db/categoryDeletion';
import ModeBanner from '@/shared/ui/ModeBanner';
import { sortOutBanner } from '../texts';

/** What is left of the category being deleted, and "Отменить". */
export default function SortOutBanner({ label, remaining, onCancel }: { label: string; remaining: Bucket | null; onCancel: () => void }) {
  return <ModeBanner text={remaining ? sortOutBanner(label, remaining) : `Удаление «${label}»`} onCancel={onCancel} testID="sort-out" />;
}
