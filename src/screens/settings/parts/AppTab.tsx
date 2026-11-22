import React from 'react';
import { openBackup, openLockOptions } from '@/shared/navigation/sheets';
import { LockSettings } from '@/features/app-lock';
import { AppVersion } from '@/features/app-update';
import Row from './Row';

/** «Приложение»: the lock, the backup, the installed version (and «Обновить до …» when a newer one is out). */
export default function AppTab({ open }: { open: boolean }) {
  return (
    <>
      <LockSettings open={open} onOptions={openLockOptions} />
      <Row label="Резервная копия" onPress={openBackup} />
      <AppVersion open={open} />
    </>
  );
}
