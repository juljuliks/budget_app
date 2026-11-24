import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { hasPassword } from '@/native/backup';
import BottomSheet from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { autoBackupStatus } from '../autoBackup';
import { exportCopy, exportCsv, restoreBackup } from '../backupFlow';
import { onBackupSettingsChanged } from '../model/changes';
import { run } from '../run';
import { BACKUP, BACKUP_INFO, EXPORT_COPY, EXPORT_CSV, RESTORE_BACKUP } from '../texts';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';
import AutoBackupSection, { type AutoState } from './AutoBackupSection';
import { font, space } from '@/shared/theme/tokens';

type Settings = { auto: AutoState; password: boolean };

/**
 * "Резервная копия" (Настройки): «Автокопия» — where it goes, «Google Диск» / «Локально» (AutoBackupSection); then
 * restore from a copy (a file or Drive; its password when encrypted), export a copy (its password offered, «Пропустить»
 * allowed), the operations as CSV.
 */
export default function BackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const load = useCallback(() => {
    Promise.all([autoBackupStatus(), hasPassword()])
      .then(([auto, password]) => setSettings({ auto, password }))
      .catch(toastFailure('load backup settings', LOAD_FAILED));
  }, []);
  useEffect(() => {
    if (visible) load();
  }, [visible, load]);
  useEffect(() => onBackupSettingsChanged(load), [load]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={BACKUP}>
      <Text style={styles.info}>{BACKUP_INFO}</Text>
      {settings ? <AutoBackupSection auto={settings.auto} password={settings.password} /> : null}
      <SheetActions
        style={styles.actions}
        submit={null}
        extra={[
          { title: RESTORE_BACKUP, onPress: run('restore', restoreBackup) },
          { title: EXPORT_COPY, onPress: run('backup', exportCopy) },
          { title: EXPORT_CSV, onPress: run('csv export', exportCsv) },
        ]}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: font.secondary, color: colors.muted, paddingHorizontal: space[20], paddingBottom: space[12] },
  actions: {
    paddingHorizontal: space[20],
    paddingTop: space[16],
    paddingBottom: space[12],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
