import React, { useCallback, useEffect, useState } from 'react';
import { NO_SECTION } from './strings';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { categoryLabel, createCategory, findCategoryByName, getCategory, moveTransactionsOutOfCategory, updateCategory } from '../db/categories';
import { CategoryType, listCategoryTypes } from '../db/categoryTypes';
import { assignCategory, assignCategoryToMany } from '../assign';
import { addPlanItem } from '../db/plans';
import { emitTransactionsChanged } from '../events';
import { returnToPrevious, RootStackParamList } from '../navigation';
import Button from './Button';
import Chip from './Chip';
import ColorSwatches from './ColorSwatches';
import { colorFromHue, distinctHue, freeCategoryColors, hexToHsl } from '../colors';
import HueBar from './HueBar';
import TypeEditModal from './TypeEditModal';
import { takenCategoryColors } from '../db/colors';
import { formStyles } from './formStyles';
import SectionHeading from './SectionHeading';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryEdit'>;

/** Create (no categoryId) or edit a category: name, emoji, optional type. */
export default function CategoryEdit({ route, navigation }: Props) {
  const { categoryId, txId, txIds, planYm, typeId: initialTypeId, returnSelection, moveFromCategoryId } = route.params ?? {};
  const isNew = categoryId === undefined;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [typeId, setTypeId] = useState<number | null>(initialTypeId ?? null);
  // own color; null = from the type's palette
  const [color, setColor] = useState<string | null>(null);
  const [types, setTypes] = useState<CategoryType[]>([]);
  const [typeOpen, setTypeOpen] = useState(false);
  // colors other categories already have: not offered
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Новая категория' : 'Категория' });
    if (isNew) return;
    getCategory(categoryId).then((c) => {
      if (!c) return;
      setName(c.name);
      setEmoji(c.emoji ?? '');
      setTypeId(c.type_id);
      setColor(c.color);
    }).catch((e) => console.error('load category failed', e));
  }, [categoryId, isNew, navigation]);

  // on focus: types may have been edited on the types screen
  const loadTypes = useCallback(() => {
    listCategoryTypes().then((t) => {
      setTypes(t);
      // the selected type was deleted meanwhile
      setTypeId((cur) => (cur !== null && !t.some((x) => x.id === cur) ? null : cur));
    }).catch((e) => console.error('load types failed', e));
  }, []);

  useFocusEffect(useCallback(() => {
    takenCategoryColors(categoryId).then(setTaken).catch((e) => console.error('load colors failed', e));
    loadTypes();
  }, [categoryId, loadTypes]));

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Введите название'); return; }
    setSaving(true);
    try {
      if (await findCategoryByName(trimmed, typeId, categoryId)) {
        setError('Такая категория уже есть');
        setSaving(false);
        return;
      }
      let createdId: number | null = null;
      if (isNew) {
        const id = await createCategory(trimmed, emoji, typeId, color);
        createdId = id;
        if (txId) await assignCategory(txId, id);
        if (txIds?.length && moveFromCategoryId !== undefined) {
          await moveTransactionsOutOfCategory(txIds, moveFromCategoryId, id);
          emitTransactionsChanged();
        } else if (txIds?.length) {
          await assignCategoryToMany(txIds, id);
        }
        if (planYm) await addPlanItem(planYm, id);
        emitTransactionsChanged();
      } else {
        await updateCategory(categoryId, { name: trimmed, emoji, typeId, color });
        emitTransactionsChanged();
      }
      // created for a transaction from its detail screen: the choice is made, leave that screen too
      const { routes } = navigation.getState();
      const prev = routes[routes.length - 2];
      if (isNew && txId && prev?.name === 'TransactionDetail') navigation.pop(2);
      // back to the screen we came from, with the new category selected there
      else if (createdId !== null && returnSelection) returnToPrevious(navigation, { selectCategoryId: createdId });
      else navigation.goBack();
    } catch (e) {
      console.error('save category failed', e);
      setError('Не удалось сохранить');
      setSaving(false);
    }
  }

  // the type's shades first: a type reads as one color family on the charts
  const colorOptions = freeCategoryColors(types, typeId, taken, color);

  const typeOptions: Array<[number | null, string]> = [[null, NO_SECTION], ...types.map((t): [number, string] => [t.id, t.name])];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* types are managed in the settings; a new one can be made right here */}
      <SectionHeading title="Раздел" />
      <View style={styles.chips}>
        {typeOptions.map(([id, label]) => (
          <Chip key={String(id)} label={label} selected={typeId === id} onPress={() => setTypeId(id)} />
        ))}
        <Chip label="＋ Новый раздел" action onPress={() => setTypeOpen(true)} />
      </View>

      <Text style={formStyles.label}>Название</Text>
      <TextInput
        style={formStyles.input}
        value={name}
        onChangeText={(v) => { setName(v); setError(null); }}
        placeholder="Например, Спорт"
        autoFocus={isNew}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {name.trim() ? (
        <Text style={styles.preview}>
          Будет выглядеть так: {categoryLabel({ emoji, name: name.trim(), type_name: types.find((t) => t.id === typeId)?.name })}
        </Text>
      ) : null}

      <Text style={formStyles.label}>Цвет</Text>
      {/* "Авто" generates a color (another one on each press) that no other category has */}
      <ColorSwatches options={colorOptions} value={color} onChange={setColor} onAuto={() => setColor(colorFromHue(distinctHue(taken, color)))} />
      {/* a color of its own: any hue on the bar */}
      <Text style={styles.customLabel}>Свой цвет</Text>
      <HueBar hue={color ? Math.round(hexToHsl(color)[0]) : null} onChange={(h) => setColor(colorFromHue(h))} />

      <Text style={formStyles.label}>Эмодзи (необязательно)</Text>
      <TextInput style={[formStyles.input, styles.emoji]} value={emoji} onChangeText={setEmoji} placeholder="🏋️" maxLength={8} />

      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {isNew && txId ? <Text style={formStyles.hint}>Категория будет назначена операции, а если у её мерчанта ещё нет категории — станет категорией мерчанта.</Text> : null}
      {isNew && txIds?.length ? <Text style={formStyles.hint}>Категория будет назначена выбранным операциям ({txIds.length}).</Text> : null}
      {isNew && planYm ? <Text style={formStyles.hint}>Категория будет добавлена в план этого месяца.</Text> : null}

      <Button title="Сохранить" disabled={saving} onPress={save} style={styles.button} />
      <TypeEditModal
        visible={typeOpen}
        types={types}
        onClose={() => setTypeOpen(false)}
        // the new type is selected for this category
        onSaved={(id) => { setTypeOpen(false); setTypeId(id); loadTypes(); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  emoji: { width: 80, textAlign: 'center' },
  preview: { color: colors.muted, marginTop: 6, fontSize: 13 },
  customLabel: { fontSize: 14, color: colors.text, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { marginTop: 24 },
});
