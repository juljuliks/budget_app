// Edit mode (🗑 on every row) and selecting several (a long press; checkboxes in front, a tap toggles).
import { MutableRefObject, useCallback, useState } from 'react';
import { GroupKind, transactionDayIds, transactionGroupIds } from '@/db/transactions';
import type { ListView, Row } from './listData';

type List = {
  rows: Row[];
  viewRef: MutableRefObject<ListView>;
  groupIds: Map<string, number[]>;
  setGroupIds: (f: (m: Map<string, number[]>) => Map<string, number[]>) => void;
};

/** `locked`: a sort-out — always selecting. */
export function useSelection({ rows, viewRef, groupIds, setGroupIds }: List, locked: boolean) {
  const [editMode, setEditMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selecting = selectMode || locked;

  const clear = useCallback(() => { setSelectMode(false); setSelected(new Set()); }, []);

  // a long press on a row starts selecting several, with that row selected
  function start(id: number) {
    setSelectMode(true);
    setSelected(new Set([id]));
  }

  // "Готово" leaves edit mode together with any selection
  function toggleEditMode() {
    setEditMode((on) => !on);
    clear();
  }

  function apply(next: Set<number>) {
    setSelected(next);
    // unselecting the last one ends the selection
    if (next.size === 0) setSelectMode(false);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    apply(next);
  }

  // a group's checkbox: all its operations, or none of them (a day: `dayStart` given, its key is the day's)
  async function toggleGroup(key: string, dayStart?: number) {
    let ids = groupIds.get(key);
    if (!ids) {
      const v = viewRef.current;
      if (dayStart !== undefined) {
        const d = new Date(dayStart * 1000);
        ids = await transactionDayIds(v.filter, dayStart, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() / 1000);
      } else ids = await transactionGroupIds(v.filter, v.groupBy as GroupKind, key);
      const got = ids;
      setGroupIds((m) => new Map(m).set(key, got));
    }
    const all = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    for (const id of ids) if (all) next.delete(id); else next.add(id);
    apply(next);
  }

  // everything currently in the list (filtered results, or the loaded part of the feed)
  const allSelected = selecting && rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelectMode(true);
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  return { editMode, setEditMode, selecting, selected, clear, start, toggleEditMode, toggle, toggleGroup, allSelected, toggleSelectAll };
}
