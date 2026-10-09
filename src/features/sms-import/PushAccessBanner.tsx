import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting } from '@/db/settings';
import { isPushAccessEnabled, openPushAccessSettings } from '@/native/notificationAccess';
import { colors } from '@/shared/theme/theme';

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
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  if (!visible) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Читать уведомления приложения TBC</Text>
      <Text style={styles.text}>
        Тогда операции появятся, даже если SMS не пришло. Другие уведомления не читаются и не сохраняются.
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity onPress={() => { setSetting(DISMISSED_KEY, '1').then(check).catch(() => {}); }} hitSlop={8}>
          <Text style={styles.later}>Не сейчас</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openPushAccessSettings} hitSlop={8}>
          <Text style={styles.enable}>Включить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  text: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
  later: { fontSize: 14, color: colors.muted },
  enable: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
