// What a crash report carries (src/native/crashReport.ts): the logged text and the Errors' messages and stack, never
// the objects logged with them (an operation, an SMS, a merchant's row). No React.

/** console.error's arguments as a report: its strings and the Errors' messages; the stack of the first Error. */
export function reportOf(args: unknown[]): { message: string; stack: string } {
  const parts = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? `${a.name}: ${a.message}` : null))
    .filter((p): p is string => !!p);
  const error = args.find((a): a is Error => a instanceof Error);
  return { message: parts.join(' ').slice(0, 500) || 'console.error', stack: error?.stack ?? new Error().stack ?? '' };
}
