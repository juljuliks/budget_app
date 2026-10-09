// The two tabs (Статистика, Операции) with their headers and the badge of the unread operations.
import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TransactionsList from '../ui/TransactionsList';
import StatsHome from '../ui/stats/StatsHome';
import HideAmountsButton from '../ui/HideAmountsButton';
import SettingsButton from './SettingsButton';
import { HistoryIcon, StatsIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { countUnseenTransactions } from '@/db/transactions';
import { onTransactionsChanged } from '@/events';
import { guardLeave, hasLeaveGuard } from '@/shared/navigation/leaveGuard';
import type { TabParamList } from '@/shared/navigation/navigation';

const headerRightStyle = { marginRight: 16 };
const statsHeaderRight = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 };
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

export default function MainTabs() {
  const unseen = useUnseenCount();
  return (
    <>
    {/* the app always opens on the transactions; the settings gear sits in the tab headers */}
    <Tab.Navigator initialRouteName="Transactions" screenOptions={{
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      // the label right under the icon, with room below it (the default leaves the labels at the very bottom)
      tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 10 },
      tabBarIconStyle: { marginBottom: -2 },
      tabBarLabelStyle: { fontSize: 12 },
    }}>
      <Tab.Screen
        name="Stats"
        component={StatsHome}
        // in the middle of a sort-out the Operations tab asks first
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!hasLeaveGuard()) return;
            e.preventDefault();
            guardLeave(() => navigation.navigate('Stats'));
          },
        })}
        options={{
          title: 'Статистика',
          tabBarIcon: ({ color }) => <StatsIcon color={color} />,
          // the eye blurs the budget and plan totals, e.g. to show the stats to someone
          headerRight: () => <View style={[headerRightStyle, statsHeaderRight]}><HideAmountsButton /><SettingsButton /></View>,
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
