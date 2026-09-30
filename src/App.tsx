import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import notifee, { EventType } from '@notifee/react-native';
import TransactionsList from './ui/TransactionsList';
import TransactionDetail from './ui/TransactionDetail';
import CreateCategory from './ui/CreateCategory';
import { createNotificationChannel } from './notifications/notifeeBootstrap';
import { handleNotificationAction } from './notifications/notifeeIntegration';
import { requestAppPermissions } from './permissions';
import { navigationRef, flushPendingNavigation, RootStackParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    createNotificationChannel();
    requestAppPermissions().catch(() => {});

    // app was launched by tapping a notification / its action button
    notifee.getInitialNotification()
      .then((initial) => initial && handleNotificationAction({ id: initial.pressAction.id, notification: initial.notification }))
      .catch((e) => console.error('initial notification failed', e));

    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        handleNotificationAction({ id: detail.pressAction?.id, notification: detail.notification })
          .catch((e) => console.error('notification action failed', e));
      }
    });

    // a press handled by the background handler may have queued a screen while we were in background
    const appState = AppState.addEventListener('change', (s) => { if (s === 'active') flushPendingNavigation(); });

    return () => { unsubscribe(); appState.remove(); };
  }, []);

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
      <Stack.Navigator>
        <Stack.Screen name="Transactions" component={TransactionsList} options={{ title: 'Транзакции' }} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetail} options={{ title: 'Транзакция' }} />
        <Stack.Screen name="CreateCategory" component={CreateCategory} options={{ title: 'Новая категория', presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
