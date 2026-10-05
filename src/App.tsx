import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import TransactionsList from './ui/TransactionsList';
import CategoriesScreen from './ui/CategoriesScreen';
import StatsHome from './ui/stats/StatsHome';
import MerchantsScreen from './ui/MerchantsScreen';
import SettingsButton from './ui/SettingsButton';
import { SheetAlertHost } from './ui/sheetAlert';
import { ModalHost } from './ui/modals';
import { ToastHost } from './ui/toast';
import { HistoryIcon, StatsIcon } from './ui/icons';
import { colors } from './ui/theme';
import { createNotificationChannel } from './notifications/notifeeBootstrap';
import { handleNotificationAction } from './notifications/notifeeIntegration';
import { requestAppPermissions } from './permissions';
import { countUnseenTransactions } from './db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from './events';
import { autoCategorizeRefunds } from './db/refunds';
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
    <>
    {/* the app always opens on the transactions; the settings gear sits in the tab headers */}
    <Tab.Navigator initialRouteName="Transactions" screenOptions={{ tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted }}>
      <Tab.Screen
        name="Stats"
        component={StatsHome}
        options={{
          title: 'Статистика',
          tabBarIcon: ({ color }) => <StatsIcon color={color} />,
          headerRight: () => <View style={headerRightStyle}><SettingsButton /></View>,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsList}
        options={{
          title: 'Операции',
          tabBarIcon: ({ color }) => <HistoryIcon color={color} />,
          tabBarBadge: unseen > 0 ? (unseen > 99 ? '99+' : unseen) : undefined,
        }}
      />
    </Tab.Navigator>
    </>
  );
}

export default function App() {
  useEffect(() => {
    createNotificationChannel();
    requestAppPermissions().catch(() => {});
    // refunds that came before their merchant had a category (or before this existed) get one
    autoCategorizeRefunds().then((n) => { if (n > 0) emitTransactionsChanged(); }).catch((e) => console.error('refund categories failed', e));

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
        <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Категории' }} />
        <Stack.Screen name="Merchants" component={MerchantsScreen} options={{ title: 'Мерчанты' }} />
      </Stack.Navigator>
      {/* the sheets over the pages (an operation, a new one, a refund, sections, deleting a category) */}
      <ModalHost />
      {/* confirmations and messages (sheetAlert), over everything */}
      <SheetAlertHost />
      {/* toasts of the pages; each sheet draws its own over itself */}
      <ToastHost />
    </NavigationContainer>
  );
}
