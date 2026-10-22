// What the card shows and edits: the merchant, its category or several (a long press in "Сменить").
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMerchant, merchantCategories, MerchantDetails } from '@/db/merchants';
import { categoryLabel, categoryLabelOf, listCategories } from '@/db/categories';
import { categoryColors } from '@/db/colors';
import type { CategoryInfo } from '@/entities/category';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';

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
    }).catch(toastFailure('load merchant', LOAD_FAILED));
  }, [merchantId]);

  // opened from an operation: the labels aren't passed in
  useEffect(() => {
    if (given || merchantId === null) return;
    Promise.all([listCategories(), categoryColors()])
      .then(([cats, colorOf]) => setLoaded(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }]))))
      .catch(toastFailure('load categories', LOAD_FAILED));
  }, [given, merchantId]);

  // a new merchant: start clean
  useEffect(() => {
    setM(null);
    load();
  }, [merchantId, load]);

  const label = async (id: number) => categories.get(id)?.label ?? await categoryLabelOf(id);
  const sameList = list.length === savedList.length && list.every((id) => savedList.includes(id));
  const dirty = !!m && (mixed !== m.mixed || (mixed ? !sameList : single !== m.category_id));

  // one category (or none): no longer of different ones. Several: each new operation asks among these.
  function chooseOne(id: number | null) {
    setMixed(false);
    setSingle(id);
  }
  function chooseSeveral(ids: number[]) {
    setMixed(true);
    setList(ids);
  }

  return { m, categories, mixed, single, list, dirty, label, load, chooseOne, chooseSeveral };
}
