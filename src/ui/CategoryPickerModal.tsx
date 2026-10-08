import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SheetActions } from './Button';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import CategoryPicker from './CategoryPicker';
import type { RootStackParamList } from '../navigation';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: number | null;
  /** several picked: each tap reports its id (the parent toggles it), the sheet stays open until "Готово" */
  selectedIds?: number[];
  transferFirst?: boolean;
  allowNone?: boolean;
  /** categories not offered (e.g. the one being deleted) */
  excludeIds?: number[];
  /** one picked, then this button reports it (instead of a tap reporting it right away) */
  saveTitle?: string;
  onPick: (categoryId: number | null) => void;
  onClose: () => void;
};

/** Bottom sheet with the shared CategoryPicker (categories, "+ Новая категория"). */
export default function CategoryPickerModal({ visible, title, selectedId, selectedIds, transferFirst, allowNone, excludeIds, saveTitle, onPick, onClose }: Props) {
  // with saveTitle: the one picked so far (undefined = none yet)
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  useEffect(() => { if (visible) setPicked(undefined); }, [visible]);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} style={styles.sheet}>
        <SheetScrollView contentContainerStyle={styles.content}>
          {/* remounted on opening: the selected ones go first in the order of that moment */}
          {visible ? <CategoryPicker
            selectedId={saveTitle ? picked : selectedId}
            selectedIds={selectedIds}
            selectedFirst={!!selectedIds}
            onSelect={saveTitle ? setPicked : onPick}
            allowNone={allowNone}
            transferFirst={transferFirst}
            excludeIds={excludeIds}
            showAll
          /> : null}
        </SheetScrollView>
        {saveTitle
          ? <SheetActions submit={{ title: saveTitle, disabled: picked === undefined, onPress: () => { if (picked !== undefined) onPick(picked); } }} onCancel={onClose} style={styles.actions} />
          : selectedIds
          ? <SheetActions submit={{ title: 'Готово', onPress: onClose }} style={styles.actions} />
          : <SheetActions submit={null} onCancel={onClose} style={styles.actions} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '75%' },
  content: { paddingHorizontal: 16 },
  actions: { paddingHorizontal: 16 },
});
