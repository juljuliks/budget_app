import type { SummaryGroupKey } from '@/entities/plan';

/** what an explanation sheet is about: the line under the donut, a category, a limits block */
export type Info = 'summary' | { id: number; name: string } | { group: SummaryGroupKey };

/** What the rows do and know beyond the view: the amounts hidden, the explanations, the operations. */
export type Handlers = {
  hidden: boolean;
  openInfo: (i: Info) => void;
  openTransactions: (categoryId: number | null) => void;
};
