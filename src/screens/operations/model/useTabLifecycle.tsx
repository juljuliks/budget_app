// The tab's header (back arrow, «Готово» while selecting, the menu ⋮), the hardware back, and a clean list on the next visit.
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HeaderBackButton } from '@react-navigation/elements';
import { forgetPages, navigationRef } from '@/shared/navigation/navigation';
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
  /** selecting several (not in a sort-out): «Готово» in the header leaves it */
  selecting: boolean;
  endSelecting: () => void;
  /** leaving for another tab: no filters, search, grouping or selection next time */
  resetOnLeave: () => void;
};

export function useTabLifecycle({ tabNavigation, from, sortingOut, askLeave, selecting, endSelecting, resetOnLeave }: Options) {
  // the latest callbacks for the listeners added once
  const cb = useRef({ askLeave, endSelecting, resetOnLeave, sortingOut });
  cb.current = { askLeave, endSelecting, resetOnLeave, sortingOut };

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { cb.current.askLeave(); return true; });
    return () => sub.remove();
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button, no sheets to come back to
  useEffect(() => tabNavigation.addListener('tabPress', () => {
    if (from) { tabNavigation.setParams({ from: undefined }); forgetPages(); }
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
      headerRight: () => <HeaderActions selecting={selecting} onDone={() => cb.current.endSelecting()} />,
    });
  }, [tabNavigation, selecting, from, sortingOut]);
}
