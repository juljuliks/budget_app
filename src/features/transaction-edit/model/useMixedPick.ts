// Chips of a mixed merchant: taps toggle. The operation's category starts selected. A later save must not drop a second chip.
import { useEffect, useRef, useState } from 'react';

export function useMixedPick(txId: number, currentId: number | null, ready: boolean) {
  const [picked, setPicked] = useState<number[]>([]);
  const key = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || key.current === txId) return;
    key.current = txId;
    setPicked(currentId != null ? [currentId] : []);
  }, [ready, txId, currentId]);
  const toggle = (id: number) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  return { picked, toggle };
}
