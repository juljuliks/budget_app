import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting } from '@/db/settings';
import { isPushAccessEnabled, openPushAccessSettings } from '@/native/notificationAccess';
import Banner from '@/shared/ui/Banner';
import { space } from '@/shared/theme/tokens';
import Button from '@/shared/ui/Button';

const DISMISSED_KEY = 'push_banner_dismissed';

/**
 * Offers reading TBC pushes until it's enabled or dismissed. Re-checks when the app comes back from the
 * settings screen.
 */
export default function PushAccessBanner() {
  const [visible, setVisible] = useState(false);

  const check = useCallback(() => {
    Promise.all([isPushAccessEnabled(), getSetting(DISMISSED_KEY)])
      .then(([enabled, dismissed]) => setVisible(!enabled && dismissed === null))
      .catch((e) => console.error('push access check failed', e));
  }, []);

  useFocusEffect(check);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  if (!visible) return null;
  return (
    <Banner
      tone="info"
      title="Читать уведомления приложения TBC"
      text="Тогда операции появятся, даже если SMS не пришло. Другие уведомления не читаются и не сохраняются."
      style={styles.box}
    >
      <View style={styles.buttons}>
        <Button
          variant="text"
          title="Не сейчас"
          size="small"
          muted
          onPress={() => {
            setSetting(DISMISSED_KEY, '1')
              .then(check)
              .catch(() => {});
          }}
        />
        <Button variant="text" title="Включить" size="small" onPress={openPushAccessSettings} />
      </View>
    </Banner>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: space[8] },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[20], marginTop: space[4] },
});
