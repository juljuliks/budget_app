import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CategoriesScreen from '../ui/CategoriesScreen';
import MerchantsScreen from '../ui/MerchantsScreen';
import MainTabs from './MainTabs';
import { ModalHost } from './ModalHost';
import { useAppStartup } from './useAppStartup';
import { SheetAlertHost } from '@/shared/ui/sheetAlert';
import { ToastHost } from '@/shared/ui/toast';
import { navigationRef, flushPendingNavigation, RootStackParamList } from '@/shared/navigation/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useAppStartup();

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
