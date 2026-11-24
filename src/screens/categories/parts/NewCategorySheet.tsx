import React, { useEffect, useState } from 'react';
import type { CategoryPlanKind } from '@/db/plans';
import { CategorySheet } from '@/entities/category';
import { KIND_OPTIONS, KIND_TITLE, setNewCategoryKind } from '@/features/category-kind';
import RadioGroup from '@/shared/ui/RadioGroup';
import SectionHeading from '@/shared/ui/SectionHeading';

type Props = {
  visible: boolean;
  typeId?: number;
  onClose: () => void;
  onSaved?: (id: number, created: boolean) => void;
};

/** CategorySheet + plan kind picker: the kind is saved after the category is created. */
export default function NewCategorySheet({ visible, typeId, onClose, onSaved }: Props) {
  const [planKind, setPlanKind] = useState<CategoryPlanKind | null>(null);

  useEffect(() => {
    if (visible) setPlanKind(null);
  }, [visible]);

  const handleSaved = async (id: number, created: boolean) => {
    if (created && planKind) await setNewCategoryKind(id, planKind);
    onSaved?.(id, created);
  };

  const extra = (
    <>
      <SectionHeading title={KIND_TITLE} />
      <RadioGroup options={KIND_OPTIONS} value={(planKind ?? '') as CategoryPlanKind} onChange={setPlanKind} />
    </>
  );

  return <CategorySheet visible={visible} typeId={typeId} onClose={onClose} onSaved={handleSaved} extra={extra} />;
}
