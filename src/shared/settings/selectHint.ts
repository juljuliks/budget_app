import { usedOnce } from './usedOnce';

// «Зажмите операцию — выбрать несколько: …» under the operations' filters: shown until selecting by a long press is used once.
const flag = usedOnce('select_used');
/** selecting several started by a long press; `false` — the hint again (tests) */
export const setSelectUsed = flag.set;
export const useSelectUsed = flag.useUsed;
