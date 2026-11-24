import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appVersion } from '@/native/appInfo';
import Button from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { checkForUpdate, onUpdateState, startUpdate, updateState, updatesOn } from '../model/update';
import { LATEST, downloading, updateTo } from '../texts';

/**
 * The bottom of «Настройки»: «Версия 1.0.N» (which build is installed: the phone's and the emulator's can differ),
 * «· последняя» when GitHub has nothing newer, and «Обновить до 1.0.M» when it has. Asks GitHub when the page opens.
 */
export default function AppVersion({ open }: { open: boolean }) {
  const { latest, checked, progress } = useSyncExternalStore(onUpdateState, updateState);
  useEffect(() => {
    if (open && updatesOn()) checkForUpdate(true).catch((e) => console.warn('update check failed', e));
  }, [open]);

  return (
    <View style={styles.box}>
      <Text style={styles.version}>
        Версия {appVersion()}
        {checked && !latest ? ` · ${LATEST}` : ''}
      </Text>
      {latest && (
        <Button
          title={progress != null ? downloading(progress) : updateTo(latest.version)}
          onPress={() => {
            startUpdate();
          }}
          disabled={progress != null}
          style={styles.button}
          testID="app-update"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  version: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  button: { marginTop: 12 },
});
