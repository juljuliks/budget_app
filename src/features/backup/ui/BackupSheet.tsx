import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hasPassword } from '@/native/backup';
import BottomSheet from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { askAutoBackupOn, autoBackupStatus, pickAutoBackupFolder, turnAutoBackupOff } from '../autoBackup';
import { exportCsv, restoreBackup, saveBackup } from '../backupFlow';
import { onBackupSettingsChanged } from '../model/changes';
import { askPasswordOn, choosePassword, removePassword } from '../password';
import { run } from '../run';
import {
  AUTO, BACKUP, BACKUP_INFO, CHANGE_FOLDER, CHANGE_PASSWORD, EXPORT_CSV, PASSWORD, PASSWORD_OFF_HINT, PASSWORD_ON_HINT,
  RESTORE_BACKUP, SAVE_BACKUP,
} from '../texts';
import SwitchRow from './SwitchRow';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';

type Settings = { auto: { on: boolean; text: string }; password: boolean };

/**
 * "Резервная копия" (Настройки): the automatic copy and the password as switches — turned on through a sheet saying
 * what they do (the folder, the password twice), off at once; under them save a copy, restore from one, CSV.
 */
export default function BackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const load = useCallback(() => {
    Promise.all([autoBackupStatus(), hasPassword()])
      .then(([auto, password]) => setSettings({ auto, password }))
      .catch(toastFailure('load backup settings', LOAD_FAILED));
  }, []);
  useEffect(() => { if (visible) load(); }, [visible, load]);
  useEffect(() => onBackupSettingsChanged(load), [load]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={BACKUP}>
      <Text style={styles.info}>{BACKUP_INFO}</Text>
      {settings ? (
        <View>
          <SwitchRow
            label={AUTO}
            hint={settings.auto.text}
            on={settings.auto.on}
            onChange={(on) => (on ? askAutoBackupOn() : run('auto backup off', turnAutoBackupOff)())}
            change={{ title: CHANGE_FOLDER, onPress: run('auto backup folder', pickAutoBackupFolder) }}
          />
          <SwitchRow
            label={PASSWORD}
            hint={settings.password ? PASSWORD_ON_HINT : PASSWORD_OFF_HINT}
            on={settings.password}
            onChange={(on) => (on ? askPasswordOn() : run('password off', removePassword)())}
            change={{ title: CHANGE_PASSWORD, onPress: run('password change', choosePassword) }}
          />
        </View>
      ) : null}
      <SheetActions
        style={styles.actions}
        submit={{ title: SAVE_BACKUP, onPress: run('backup', saveBackup) }}
        extra={[
          { title: RESTORE_BACKUP, onPress: run('restore', restoreBackup) },
          { title: EXPORT_CSV, onPress: run('csv export', exportCsv) },
        ]}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: 14, color: colors.muted, paddingHorizontal: 20, paddingBottom: 12 },
  actions: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
