import React, { useEffect, useState } from 'react';
import { Controller, useFormState, useWatch } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { categoriesOfMerchants, mergeMerchants, MerchantRow } from '../db/merchants';
import { emitTransactionsChanged } from '../events';
import { SheetActions } from './Button';
import Chip from './Chip';
import { formStyles } from './formStyles';
import type { CategoryInfo } from './MerchantsScreen';
import { colors } from './theme';
import { submitForm, useLoadedForm } from './form';
import { toast, toastError } from './toast';

type Props = {
  visible: boolean;
  merchants: MerchantRow[];
  categories: Map<number, CategoryInfo>;
  onDone: () => void;
  onClose: () => void;
};

/**
 * Merging the selected merchants into one group: its name (the most frequent one's by default, or the
 * selected group's) and its one category (one of those the merchants have, or none).
 */
export default function MergeMerchantsModal({ visible, merchants, categories, onDone, onClose }: Props) {
  const [options, setOptions] = useState<number[] | null>(null);
  // the group's name (the selected group's, else the most frequent merchant's) and the most used category
  const group = merchants.find((m) => m.group);
  const top = [...merchants].sort((a, b) => b.count - a.count)[0];
  const form = useLoadedForm<{ name: string; categoryId: number | null }>(
    visible && options ? { name: group?.name ?? top?.name ?? '', categoryId: options[0] ?? null } : null, visible);
  const categoryId = useWatch({ control: form.control, name: 'categoryId' }) ?? null;
  const { isSubmitting: saving } = useFormState({ control: form.control });

  useEffect(() => {
    if (!visible) { setOptions(null); return; }
    categoriesOfMerchants(merchants.map((m) => m.id)).then(setOptions).catch((e) => console.error('load merchant categories failed', e));
    // only when opened: the selection doesn't change while the dialog is up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const merge = submitForm(form, async (v) => {
    try {
      await mergeMerchants(merchants.map((m) => m.id), v.name, v.categoryId);
      emitTransactionsChanged();
      toast(`Объединено в группу «${v.name.trim()}»`);
      onDone();
    } catch (e) {
      console.error('merge merchants failed', e);
      toastError('Не удалось объединить');
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Объединить в группу">
        <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.members}>{merchants.map((m) => (m.group ? `${m.name} (${m.members.join(', ')})` : m.name)).join(', ')}</Text>

          <Text style={formStyles.label}>Название группы</Text>
          <Controller
            control={form.control}
            name="name"
            rules={{ validate: (v) => !!v?.trim() || 'Введите название группы' }}
            render={({ field }) => (
              <TextInput
                style={formStyles.input}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Например, SPAR"
                maxLength={40}
              />
            )}
          />

          <Text style={formStyles.label}>Категория группы</Text>
          <View style={styles.chips}>
            {(options ?? []).map((id) => (
              <Chip key={id} label={categories.get(id)?.label ?? '?'} selected={categoryId === id} onPress={() => form.setValue('categoryId', id, { shouldDirty: true })} />
            ))}
            <Chip label="Без категории" selected={categoryId === null} onPress={() => form.setValue('categoryId', null, { shouldDirty: true })} />
          </View>
          <Text style={formStyles.hint}>
            У группы одна категория: её получают новые операции всех мерчантов группы и их прошлые операции с
            автоматической категорией. Выбранные вручную категории не меняются.
          </Text>

          <SheetActions submit={{ title: 'Объединить', onPress: merge, disabled: saving }} onCancel={onClose} />
        </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  members: { fontSize: 14, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
