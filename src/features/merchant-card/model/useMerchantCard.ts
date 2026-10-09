// What the card shows and edits: the merchant, of different categories or not, its category or its list.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMerchant, merchantCategories, MerchantDetails, merchantUsedCategories } from '@/db/merchants';
import { categoryLabel, categoryLabelOf, listCategories } from '@/db/categories';
import { categoryColors } from '@/db/colors';
import type { CategoryInfo } from '@/entities/category';
import { colors } from '@/shared/theme/theme';

export function useMerchantCard(merchantId: string | null, given: Map<number, CategoryInfo> | undefined, onClose: () => void) {
  const [m, setM] = useState<MerchantDetails | null>(null);
  const [loaded, setLoaded] = useState<Map<number, CategoryInfo>>(new Map());
  const categories = given ?? loaded;
  // what the card edits, saved with "Сохранить": of different categories or not, the merchant's category, its list
  const [mixed, setMixed] = useState(false);
  const [single, setSingle] = useState<number | null>(null);
  const [list, setList] = useState<number[]>([]);
  // the saved list (to tell what changed)
  const [savedList, setSavedList] = useState<number[]>([]);

  // the parent passes onClose inline: kept in a ref so a parent re-render doesn't reset and reload the card
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(() => {
    if (merchantId === null) return;
    Promise.all([getMerchant(merchantId), merchantCategories(merchantId, 100)]).then(([d, cs]) => {
      setM(d);
      // the merchant is gone (deleted meanwhile)
      if (!d) { onCloseRef.current(); return; }
      setMixed(d.mixed);
      setSingle(d.category_id);
      setList(cs.map((c) => c.id));
      setSavedList(cs.map((c) => c.id));
    }).catch((e) => console.error('load merchant failed', e));
  }, [merchantId]);

  // opened from an operation: the labels aren't passed in
  useEffect(() => {
    if (given || merchantId === null) return;
    Promise.all([listCategories(), categoryColors()])
      .then(([cats, colorOf]) => setLoaded(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }]))))
      .catch((e) => console.error('load categories failed', e));
  }, [given, merchantId]);

  // a new merchant: start clean
  useEffect(() => {
    setM(null);
    load();
  }, [merchantId, load]);

  const label = async (id: number) => categories.get(id)?.label ?? await categoryLabelOf(id);
  const sameList = list.length === savedList.length && list.every((id) => savedList.includes(id));
  const dirty = !!m && (mixed !== m.mixed || (mixed ? !sameList : single !== m.category_id));

  // switched on with an empty list: the categories its operations have, picked already
  function switchMixed(on: boolean) {
    setMixed(on);
    if (on && m && list.length === 0) merchantUsedCategories(m.id).then(setList).catch((e) => console.error('load used categories failed', e));
  }

  function toggle(id: number | null) {
    // "Без категории": the merchant's own choice (not offered in the list of different ones)
    if (id === null) { if (!mixed) setSingle(null); return; }
    if (mixed) setList((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    else setSingle(id);
  }

  return { m, categories, mixed, single, list, dirty, label, load, switchMixed, toggle, setSingle };
}
