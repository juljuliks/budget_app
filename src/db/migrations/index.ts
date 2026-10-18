// The database's schema: its migrations in order and how they are applied.
import type { Db } from '../types';
import { STEPS_1_12 } from './steps-1-12';
import { STEPS_13_ON } from './steps-13-on';
import { STEPS_33_ON } from './steps-33-on';
import { STEPS_43_ON } from './steps-43-on';
import type { MigrationStep } from './step';

export type { MigrationStep } from './step';

// Each migration is a list of single statements (quick-sqlite executes one statement per call).
// Append new migrations to the end; never edit ones that have shipped.
// PRAGMA user_version stores how many have been applied.
export const MIGRATIONS: MigrationStep[][] = [...STEPS_1_12, ...STEPS_13_ON, ...STEPS_33_ON, ...STEPS_43_ON];

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(db: Db, migrations: MigrationStep[][] = MIGRATIONS): Promise<number> {
  const current = await getSchemaVersion(db);
  for (let v = current; v < migrations.length; v++) {
    await db.transaction(async (tx) => {
      for (const step of migrations[v]) {
        if (typeof step === 'string') await tx.run(step);
        else await step(tx);
      }
      // PRAGMA doesn't accept bound parameters; v is always an integer here
      await tx.run(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return migrations.length;
}
