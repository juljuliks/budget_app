import { usedOnce } from './usedOnce';

// «Зажмите категорию — …» under the month's bar: shown until a long press's button is used once.
const flag = usedOnce('row_menu_used');
/** a long press's button used (PressMenu); `false` — the hint again (tests) */
export const setRowMenuUsed = flag.set;
export const useRowMenuUsed = flag.useUsed;
