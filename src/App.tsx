import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import TransactionsList from './ui/TransactionsList';
import TransactionDetail from './ui/TransactionDetail';
import CategoryEdit from './ui/CategoryEdit';
import CategoriesScreen from './ui/CategoriesScreen';
import CategoryDelete from './ui/CategoryDelete';
import CategoryTypes from './ui/CategoryTypes';
import AddTransaction from './ui/AddTransaction';
import StatsHome from './ui/stats/StatsHome';
import { HistoryIcon, StatsIcon } from './ui/icons';
import { colors } from './ui/theme';
import { createNotificationChannel } from './notifications/notifeeBootstrap';
import { handleNotificationAction } from './notifications/notifeeIntegration';
import { requestAppPermissions } from './permissions';
import { countUnseenTransactions } from './db/transactions';
import { onTransactionsChanged } from './events';
import { navigationRef, flushPendingNavigation, RootStackParamList, TabParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Unread (not yet opened) transactions for the tab badge; refreshed on any data change. */
function useUnseenCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => { countUnseenTransactions().then(setCount).catch((e) => console.error('unseen count failed', e)); };
    load();
    const off = onTransactionsChanged(load);
    // SMS processed while the app was in background
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => { off(); sub.remove(); };
  }, []);
  return count;
}

function MainTabs() {
  const unseen = useUnseenCount();
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
      <Tab.Screen
        name="Stats"
        component={StatsHome}
        options={{ title: 'Статистика', tabBarIcon: ({ color }) => <StatsIcon color={color} /> }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsList}
        options={{
          title: 'Транзакции',
          tabBarIcon: ({ color }) => <HistoryIcon color={color} />,
          tabBarBadge: unseen > 0 ? (unseen > 99 ? '99+' : unseen) : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

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
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetail} options={{ title: 'Транзакция' }} />
        <Stack.Screen name="CategoryEdit" component={CategoryEdit} options={{ title: 'Категория' }} />
        <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Категории' }} />
        <Stack.Screen name="CategoryDelete" component={CategoryDelete} options={{ title: 'Удаление категории' }} />
        <Stack.Screen name="CategoryTypes" component={CategoryTypes} options={{ title: 'Типы категорий' }} />
        <Stack.Screen name="AddTransaction" component={AddTransaction} options={{ title: 'Новая транзакция' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
