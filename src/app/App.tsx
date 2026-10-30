import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CategoriesScreen } from '@/screens/categories';
import { MerchantsScreen } from '@/screens/merchants';
import { MessageTemplatesScreen, UnparsedMessageScreen, UnparsedScreen } from '@/screens/messages';
import { BanksScreen } from '@/screens/banks';
import { SettingsScreen } from '@/screens/settings';
import { OperationScreen } from '@/screens/operation';
import { MerchantScreen } from '@/screens/merchant';
import { CategoryScreen } from '@/screens/category';
import { CategoryTrendScreen, HistoryScreen, PlanScreen, TRENDS_TITLE, TrendsScreen } from '@/screens/stats';
import MainTabs from './MainTabs';
import { ModalHost } from './ModalHost';
import { useAppStartup } from './useAppStartup';
import { SheetAlertHost } from '@/shared/ui/sheetAlert';
import { ToastHost } from '@/shared/ui/toast';
import { LockHost } from '@/features/app-lock';
import { navigationRef, flushPendingNavigation, RootStackParamList } from '@/shared/navigation/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useAppStartup();

  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation}>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
        <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Категории' }} />
        <Stack.Screen name="Merchants" component={MerchantsScreen} options={{ title: 'Мерчанты' }} />
        <Stack.Screen name="Unparsed" component={UnparsedScreen} options={{ title: 'Не распознано' }} />
        <Stack.Screen name="UnparsedMessage" component={UnparsedMessageScreen} options={{ title: '' }} />
        <Stack.Screen name="MessageTemplates" component={MessageTemplatesScreen} options={{ title: 'Шаблоны сообщений' }} />
        <Stack.Screen name="Banks" component={BanksScreen} options={{ title: 'Банки' }} />
        {/* the budget's things: pages over each other, back walks the chain */}
        <Stack.Screen name="Operation" component={OperationScreen} options={{ title: 'Операция' }} />
        <Stack.Screen name="Merchant" component={MerchantScreen} options={{ title: '' }} />
        <Stack.Screen name="Category" component={CategoryScreen} options={{ title: '' }} />
        <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'План' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'История по месяцам' }} />
        <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: TRENDS_TITLE }} />
        <Stack.Screen name="CategoryTrend" component={CategoryTrendScreen} options={{ title: '' }} />
      </Stack.Navigator>
      {/* the sheets over the pages (a new operation, sections, deleting a category, a repeating payment, …) */}
      <ModalHost />
      {/* confirmations and messages (sheetAlert), over everything */}
      <SheetAlertHost />
      {/* toasts of the pages; each sheet draws its own over itself */}
      <ToastHost />
      {/* the lock screen and the PIN windows, over all of it */}
      <LockHost />
    </NavigationContainer>
  );
}
