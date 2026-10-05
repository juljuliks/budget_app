import { useEffect, useState } from 'react';

/** The last non-null value: a sheet keeps showing its content while it slides away after being closed. */
export function useLast<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value);
  useEffect(() => { if (value !== null) setLast(value); }, [value]);
  return value ?? last;
}
