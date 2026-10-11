import type { Db } from '../types';

/** A migration step: one SQL statement, or a function for data fixes SQL can't express (re-parsing SMS). */
export type MigrationStep = string | ((db: Db) => Promise<void>);
