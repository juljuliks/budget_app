import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { CreateButton } from '@/shared/ui/PlusButton';
import SearchBar from '@/shared/ui/SearchBar';
import { colors } from '@/shared/theme/theme';
import { useCategoryChoose, type ChooseProps } from '../model/useCategoryChoose';
import { FIND_CATEGORY, SEVERAL_HINT } from '../texts';
import CategoryChooseList from './CategoryChooseList';
import CategorySheet from './CategorySheet';

type Props = ChooseProps & { title: string };

/**
 * The one category list, wherever a category is chosen: sections like Настройки → Категории, a search, "＋ Создать".
 * One tap picks and closes (unless saveTitle: highlight, then the button). A long press picks several
 * ("Готово" / "Отмена"); "Отмена" clears them and stays, unless the sheet opened already on several — then it closes.
 */
export default function CategoryPickerModal(props: Props) {
  const c = useCategoryChoose(props);
  const empty = !c.none && c.sections.length === 0;
  return (
    <BottomSheet
      visible={props.visible}
      onClose={props.onClose}
      title={props.title}
      style={styles.sheet}
      headerRight={<CreateButton onPress={() => c.setCreating(true)} accessibilityLabel="Новая категория" style={styles.create} />}
    >
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <SearchBar value={c.query} onChange={c.setQuery} placeholder={FIND_CATEGORY} />
          {c.hint ? <Text style={styles.hint}>{SEVERAL_HINT}</Text> : null}
          {c.many ? <Text style={styles.picked}>Выбрано: {c.picked.length}</Text> : null}
        </View>
        <CategoryChooseList
          sections={c.sections}
          colorOf={c.colorOf}
          none={c.none}
          many={c.many}
          picked={c.picked}
          current={c.current}
          onPress={c.press}
          onHold={c.hold}
          onNone={c.pressNone}
        />
        {empty ? <Text style={styles.empty}>Не найдено.</Text> : null}
      </SheetScrollView>
      {c.many ? (
        <SheetActions
          submit={{ title: 'Готово', disabled: c.picked.length < c.min, onPress: c.done }}
          onCancel={c.cancelMany}
          style={styles.actions}
        />
      ) : props.saveTitle ? (
        <SheetActions
          submit={{ title: props.saveTitle, disabled: c.draft === undefined, onPress: () => { if (c.draft !== undefined) props.onPick(c.draft); } }}
          onCancel={props.onClose}
          style={styles.actions}
        />
      ) : null}
      <CategorySheet
        visible={c.creating}
        typeId={props.transferFirst ? c.transferTypeId ?? undefined : undefined}
        quick
        onClose={() => c.setCreating(false)}
        onSaved={(id) => c.created(id)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  content: { paddingBottom: 8 },
  top: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  create: { marginTop: 8 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  picked: { fontSize: 15, color: colors.text },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  actions: { paddingHorizontal: 16 },
});
