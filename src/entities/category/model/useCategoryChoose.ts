// The shared category sheet: one tap picks, a long press picks several, "Готово" reports them.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Category, listCategories } from '@/db/categories';
import { categoryColors } from '@/db/colors';
import { getTransferTypeId } from '@/db/categoryTypes';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { toastFailure } from '@/shared/ui/toast';
import { orderedSections, showNone } from './chooseList';

export type ChooseProps = {
  visible: boolean;
  /** the one chosen now (a check on its row) */
  selectedId?: number | null;
  /** opens already picking several, these checked */
  selectedIds?: number[];
  /** "Готово" with the whole set. Also: a long press may start several, when this is set. */
  onSeveral?: (ids: number[]) => void;
  /** a long press that starts several keeps selectedId checked, and first */
  keepSelected?: boolean;
  /** "Готово" needs at least this many. Default 2, or 1 when opened with selectedIds. */
  severalMin?: number;
  allowNone?: boolean;
  transferFirst?: boolean;
  deposit?: boolean;
  excludeIds?: number[];
  /** one highlighted, then this button reports it (a tap does not) */
  saveTitle?: string;
  onPick: (id: number | null) => void;
  onClose: () => void;
};

export function useCategoryChoose(p: ChooseProps) {
  const [cats, setCats] = useState<Category[]>([]);
  const [colorOf, setColorOf] = useState<Map<number, string>>(new Map());
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [many, setMany] = useState(false);
  const [openedMany, setOpenedMany] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const idsRef = useRef(p.selectedIds);
  idsRef.current = p.selectedIds;

  const load = useCallback(() => {
    Promise.all([listCategories(), categoryColors(), p.transferFirst ? getTransferTypeId() : Promise.resolve(null)])
      .then(([list, colors, typeId]) => { setCats(list); setColorOf(colors); setTransferTypeId(typeId); })
      .catch(toastFailure('load categories', LOAD_FAILED));
  }, [p.transferFirst]);

  // fresh each time it opens; a new selectedIds while it stays open must not wipe what was tapped
  useEffect(() => {
    if (!p.visible) return;
    const ids = idsRef.current;
    setQuery('');
    setOpenedMany(ids !== undefined);
    setMany(ids !== undefined);
    setPicked(ids ? [...ids] : []);
    setDraft(undefined);
    setCreating(false);
    load();
  }, [p.visible, load]);

  const min = p.severalMin ?? (openedMany ? 1 : 2);
  const toggle = (id: number) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return {
    query, setQuery, colorOf, transferTypeId, creating, setCreating,
    many, picked, draft, min,
    sections: orderedSections(cats, { query, excludeIds: p.excludeIds, deposit: p.deposit, transferFirst: p.transferFirst }),
    none: showNone(query, !!p.allowNone),
    current: p.saveTitle ? draft : p.selectedId,
    hint: !!p.onSeveral && !p.saveTitle && !many,
    press(id: number) {
      if (many) { toggle(id); return; }
      if (p.saveTitle) { setDraft(id); return; }
      p.onPick(id);
      p.onClose();
    },
    hold(id: number) {
      if (!p.onSeveral || p.saveTitle) return;
      if (!many) {
        setMany(true);
        const kept = p.keepSelected && p.selectedId != null && p.selectedId !== id ? [p.selectedId] : [];
        setPicked([...kept, id]);
        return;
      }
      toggle(id);
    },
    pressNone() {
      if (many) return;
      if (p.saveTitle) { setDraft(null); return; }
      p.onPick(null);
      p.onClose();
    },
    cancelMany() {
      if (openedMany) p.onClose();
      else { setMany(false); setPicked([]); }
    },
    done() {
      if (picked.length < min) return;
      p.onSeveral?.(picked);
      p.onClose();
    },
    created(id: number) {
      load();
      if (many) setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]));
      else if (p.saveTitle) setDraft(id);
      else { p.onPick(id); p.onClose(); }
    },
  };
}
