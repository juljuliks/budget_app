// Lists in SQL: constants written in, values bound.

/** `'a', 'b'`: constants written into SQL (kinds and the like, never user input). */
export const sqlList = (values: ReadonlyArray<string>) => values.map((v) => `'${v}'`).join(', ');

/** `?, ?, ?`: bound parameters for a list of values. */
export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');
