// The tab's header (back arrow, "Редактировать", the gear), the hardware back, and a clean list on the next visit.
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HeaderBackButton } from '@react-navigation/elements';
import { navigationRef } from '@/shared/navigation/navigation';
import HeaderActions from '../parts/HeaderActions';
import type { TabNavigation } from './useOperationsRoute';

type Options = {
  tabNavigation: TabNavigation;
  /** where back returns (opened from another screen) */
  from: string | undefined;
  /** a sort-out going on: the back arrow too, and leaving the tab keeps the list */
  sortingOut: boolean;
  /** back: asks first during a sort-out */
  askLeave: () => void;
  editMode: boolean;
  toggleEditMode: () => void;
  /** leaving for another tab: no filters, search, grouping or edit mode next time */
  resetOnLeave: () => void;
};

export function useTabLifecycle({ tabNavigation, from, sortingOut, askLeave, editMode, toggleEditMode, resetOnLeave }: Options) {
  // the latest callbacks for the listeners added once
  const cb = useRef({ askLeave, toggleEditMode, resetOnLeave, sortingOut });
  cb.current = { askLeave, toggleEditMode, resetOnLeave, sortingOut };

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { cb.current.askLeave(); return true; });
    return () => sub.remove();
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button
  useEffect(() => tabNavigation.addListener('tabPress', () => {
    if (from) tabNavigation.setParams({ from: undefined });
  }), [tabNavigation, from]);

  // Leaving for another tab starts the next visit clean. A screen pushed over the tabs (merchants, categories) keeps the
  // list, to come back to the same one; a sort-out stays: back on the tab, it goes on
  useEffect(() => tabNavigation.addListener('blur', () => {
    const routes = navigationRef.getRootState()?.routes;
    if (routes && routes[routes.length - 1].name !== 'Main') return;
    if (cb.current.sortingOut) return;
    cb.current.resetOnLeave();
  }), [tabNavigation]);

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft: from || sortingOut
        ? () => <HeaderBackButton onPress={() => cb.current.askLeave()} accessibilityLabel="Назад" />
        : undefined,
      headerRight: () => <HeaderActions editMode={editMode} onToggle={() => cb.current.toggleEditMode()} />,
    });
  }, [tabNavigation, editMode, from, sortingOut]);
}
