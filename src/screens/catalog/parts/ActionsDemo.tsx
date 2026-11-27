import React from 'react';
import { StyleSheet, View } from 'react-native';
import Button from '@/shared/ui/Button';
import Chip from '@/shared/ui/Chip';
import LinkCard from '@/shared/ui/LinkCard';
import PlusButton from '@/shared/ui/PlusButton';
import RowActions from '@/shared/ui/RowActions';
import TextLink from '@/shared/ui/TextLink';
import { HistoryIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { font, space } from '@/shared/theme/tokens';
import Frame from './Frame';

const noop = () => {};

/** Buttons, links and chips: what a tap does. */
export default function ActionsDemo() {
  return (
    <>
      <Frame
        name="Button"
        note="primary — главное действие, secondary — другой выбор, cancel — отказ, text — действие текстом; danger, muted, small"
      >
        <Button title="Сохранить" onPress={noop} />
        <Button title="Другой выбор" variant="secondary" onPress={noop} />
        <Button title="Отмена" variant="cancel" onPress={noop} />
        <Button title="Удалить" danger onPress={noop} />
        <Button title="Неактивна" disabled onPress={noop} />
        <View style={styles.row}>
          <Button title="＋ В план" size="small" onPress={noop} />
          <Button title="Готово" size="small" variant="secondary" onPress={noop} />
        </View>
        <View style={styles.row}>
          <Button title="Отмена" variant="text" onPress={noop} />
          <Button title="Сбросить все" variant="text" size="small" danger onPress={noop} />
          <Button title="Не сейчас" variant="text" size="small" muted onPress={noop} />
        </View>
      </Frame>
      <Frame name="TextLink" note="название-ссылка «… ›»: мерчант, категория, «Подвести итоги»">
        <TextLink label="SPAR" onPress={noop} />
        <TextLink label="Подвести итоги" onPress={noop} style={styles.small} />
      </Frame>
      <Frame name="LinkCard" note="ссылка карточкой со значком">
        <LinkCard icon={<HistoryIcon color={colors.accent} />} label="История по месяцам" onPress={noop} />
      </Frame>
      <Frame name="PlusButton · RowActions" note="круглый ＋ (создать); ✎ и 🗑 в строке">
        <View style={styles.row}>
          <PlusButton onPress={noop} accessibilityLabel="Создать" />
          <PlusButton onPress={noop} accessibilityLabel="Создать" size={32} />
          <RowActions onEdit={noop} onDelete={noop} subject="категорию" />
        </View>
      </Frame>
      <Frame name="Chip" note="выбор из нескольких: обычный, выбран, small, compact, action, muted, trailing, caption">
        <View style={styles.wrap}>
          <Chip label="🛒 Продукты" onPress={noop} />
          <Chip label="Выбран" selected onPress={noop} />
          <Chip label="Мягко" selected soft onPress={noop} />
          <Chip label="Удалённая" muted onPress={noop} />
          <Chip label="Сбросить все" action onPress={noop} />
          <Chip label="Small" small onPress={noop} />
          <Chip label="Compact" compact onPress={noop} />
          <Chip label="Фильтр" small selected trailing="✕" onPress={noop} />
          <Chip label="Новая категория" add onPress={noop} />
        </View>
        <View style={styles.row}>
          <Chip label="😰" caption="Тревога" fill onPress={noop} />
          <Chip label="🥱" caption="Скука" fill selected soft onPress={noop} />
          <Chip label="🎉" caption="Радость" fill onPress={noop} />
        </View>
      </Frame>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[8] },
  small: { fontSize: font.secondary },
});
