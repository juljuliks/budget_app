// A screen in the middle of something (sorting out a category being deleted) asks before any way out of it: the
// tab bar, the settings gear. It gets the step to take if the user agrees to leave.
type Guard = (proceed: () => void) => void;
let guard: Guard | null = null;

/** Set while the screen should ask; returns the remover. */
export function setLeaveGuard(g: Guard): () => void {
  guard = g;
  return () => { if (guard === g) guard = null; };
}

export const hasLeaveGuard = () => guard !== null;

/** Leaves now, or asks first when a screen guards it. */
export function guardLeave(proceed: () => void) {
  if (guard) guard(proceed);
  else proceed();
}
