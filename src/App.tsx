import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
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
import RefundResolve from './ui/RefundResolve';
import StatsHome from './ui/stats/StatsHome';
import MerchantsScreen from './ui/MerchantsScreen';
import DayStats from './ui/stats/DayStats';
import SettingsMenuButton from './ui/SettingsMenuButton';
import { HistoryIcon, StatsIcon } from './ui/icons';
import { colors } from './ui/theme';
import { createNotificationChannel } from './notifications/notifeeBootstrap';
import { handleNotificationAction } from './notifications/notifeeIntegration';
import { requestAppPermissions } from './permissions';
import { countUnseenTransactions } from './db/transactions';
import { onTransactionsChanged } from './events';
import { navigationRef, flushPendingNavigation, RootStackParamList, TabParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const headerRightStyle = { marginRight: 16 };
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
    // the app always opens on the transactions
    <Tab.Navigator initialRouteName="Transactions" screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
      <Tab.Screen
        name="Stats"
        component={StatsHome}
        options={{
          title: 'Статистика',
          tabBarIcon: ({ color }) => <StatsIcon color={color} />,
          headerRight: () => <View style={headerRightStyle}><SettingsMenuButton /></View>,
        }}
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
        <Stack.Screen name="Merchants" component={MerchantsScreen} options={{ title: 'Мерчанты' }} />
        <Stack.Screen name="DayStats" component={DayStats} options={{ title: 'Траты за день' }} />
        <Stack.Screen name="CategoryDelete" component={CategoryDelete} options={{ title: 'Удаление категории' }} />
        <Stack.Screen name="CategoryTypes" component={CategoryTypes} options={{ title: 'Типы' }} />
        <Stack.Screen name="AddTransaction" component={AddTransaction} options={{ title: 'Новая транзакция' }} />
        <Stack.Screen name="RefundResolve" component={RefundResolve} options={{ title: 'Возврат' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
