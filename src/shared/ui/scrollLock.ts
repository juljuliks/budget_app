// A scroll view's scrolling switched off from a row inside it: a long press's buttons followed by the finger
// (PressMenu) — else the list takes the drag and the buttons lose the finger.
import { createContext, useContext } from 'react';

/** on — the enclosing scroll view doesn't scroll; off — it does again. Outside one: nothing. */
export const ScrollLockContext = createContext<(on: boolean) => void>(() => {});

export const useScrollLock = () => useContext(ScrollLockContext);
