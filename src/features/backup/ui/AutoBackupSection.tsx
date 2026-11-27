import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Button from '@/shared/ui/Button';
import RadioGroup from '@/shared/ui/RadioGroup';
import SwitchRow from '@/shared/ui/SwitchRow';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { CANCEL } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import { pickAutoBackupFolder, turnAutoBackupOff } from '../autoBackup';
import { turnCloudOn } from '../cloud';
import { choosePassword } from '../password';
import { run } from '../run';
import {
  AUTO,
  AUTO_OFF_QUESTION,
  autoOffInfo,
  CHANGE_ACCOUNT,
  CHANGE_FOLDER,
  CHANGE_PASSWORD,
  CLOUD,
  CLOUD_OFF_HINT,
  cloudHint,
  LOCAL,
  LOCAL_HINT,
  SAVE,
  SET_PASSWORD,
  TURN_OFF,
} from '../texts';
import { font, space } from '@/shared/theme/tokens';

type Where = 'cloud' | 'local';
export type AutoState = { on: boolean; cloud: string | null; text: string };

const toCloud = run('cloud backup on', turnCloudOn);
const toFolder = run('auto backup on', pickAutoBackupFolder);

/**
 * «Автокопия» in the backup sheet: its switch. Turned on — where it goes, «Google Диск» / «Локально» (the default), and
 * «Сохранить» the first time: it goes on — Google: signed in, the password (a must); local: the folder, the password
 * («Пропустить» allowed); the first copy then. Already on — no «Сохранить»: the other radio button goes there at once;
 * «Сменить папку» / «Сменить аккаунт», «Сменить пароль» (or «Задать пароль» for a folder's copies without one). Turned off — asked first.
 */
export default function AutoBackupSection({ auto, password }: { auto: AutoState; password: boolean }) {
  const current: Where = auto.cloud ? 'cloud' : 'local';
  // the switch turned on, nothing saved yet: the choice and «Сохранить»
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<Where>('local');
  useEffect(() => {
    if (auto.on) setChoosing(false);
  }, [auto.on]);

  const flip = (on: boolean) => {
    if (on) {
      setPicked('local');
      setChoosing(true);
      return;
    }
    if (!auto.on) {
      setChoosing(false);
      return;
    }
    sheetAlert(AUTO_OFF_QUESTION, autoOffInfo(!!auto.cloud), [
      { text: TURN_OFF, style: 'destructive', onPress: run('auto backup off', turnAutoBackupOff) },
      { text: CANCEL, style: 'cancel' },
    ]);
  };
  const pick = (w: Where) => {
    if (!auto.on) {
      setPicked(w);
      return;
    }
    // on already: the other place at once, nothing to save
    if (w !== current) (w === 'cloud' ? toCloud : toFolder)();
  };
  const links = auto.on
    ? [
        auto.cloud
          ? { title: CHANGE_ACCOUNT, onPress: toCloud }
          : { title: CHANGE_FOLDER, onPress: run('auto backup folder', pickAutoBackupFolder) },
        // a folder's copies without a password: «Задать пароль» (Google Drive has one always)
        { title: password ? CHANGE_PASSWORD : SET_PASSWORD, onPress: run('password', async () => choosePassword()) },
      ]
    : [];

  return (
    <View>
      <SwitchRow label={AUTO} hint={auto.text} on={auto.on || choosing} onChange={flip} />
      {auto.on || choosing ? (
        <View style={styles.box}>
          <RadioGroup<Where>
            value={auto.on ? current : picked}
            onChange={pick}
            options={[
              ['cloud', CLOUD, auto.cloud ? cloudHint(auto.cloud) : CLOUD_OFF_HINT],
              ['local', LOCAL, LOCAL_HINT],
            ]}
          />
          {!auto.on ? (
            <Button title={SAVE} onPress={picked === 'cloud' ? toCloud : toFolder} style={styles.save} />
          ) : null}
          {links.length ? (
            <View style={styles.links}>
              {links.map((l) => (
                <Button key={l.title} variant="text" title={l.title} size="small" onPress={l.onPress} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: space[20], paddingBottom: space[12] },
  save: { marginTop: space[8] },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[20], rowGap: space[4], marginTop: space[8] },
  link: { fontSize: font.secondary, color: colors.accent },
});
