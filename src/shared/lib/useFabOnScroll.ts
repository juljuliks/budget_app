// «＋» over a long list (the operations, the month's stats): hidden while scrolling down (it would cover the amounts
// at the right), back on scrolling up or at the top.
import { useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** a move this small either way changes nothing */
const SLOP = 8;

/** `resetKey` changed (a list remounted at its top): «＋» is back */
export function useFabOnScroll(resetKey?: string) {
  const [shown, setShown] = useState(true);
  const last = useRef(0);
  useEffect(() => { last.current = 0; setShown(true); }, [resetKey]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - last.current;
    if (Math.abs(dy) < SLOP) return;
    last.current = y;
    const show = dy < 0 || y <= 0;
    if (show !== shown) setShown(show);
  };
  return { shown, onScroll };
}
