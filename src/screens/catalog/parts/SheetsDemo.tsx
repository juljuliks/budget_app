import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BackLink from '@/shared/ui/BackLink';
import BottomSheet from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import EmojiPicker from '@/shared/ui/EmojiPicker';
import Fab from '@/shared/ui/Fab';
import RangeCalendar, { DayRange } from '@/shared/ui/RangeCalendar';
import StepsNav from '@/shared/ui/StepsNav';
import TextInputModal from '@/shared/ui/TextInputModal';
import { colors } from '@/shared/theme/theme';
import { font, space } from '@/shared/theme/tokens';
import Frame from './Frame';

const noop = () => {};

/** Over the screen and between steps: sheets, the input dialog, emoji, the calendar, «＋», steps. */
export default function SheetsDemo() {
  const [open, setOpen] = useState<'sheet' | 'input' | 'emoji' | null>(null);
  const close = () => setOpen(null);
  const [emoji, setEmoji] = useState('🛒');
  const [range, setRange] = useState<DayRange | null>(null);
  const [step, setStep] = useState(1);
  return (
    <>
      <Frame name="BottomSheet · TextInputModal · EmojiPicker" note="шит снизу; окно ввода одного значения; эмодзи">
        <Button title="Шит" variant="secondary" onPress={() => setOpen('sheet')} />
        <Button title="Окно ввода" variant="secondary" onPress={() => setOpen('input')} />
        <Button title={`Эмодзи ${emoji}`} variant="secondary" onPress={() => setOpen('emoji')} />
        <BottomSheet visible={open === 'sheet'} onClose={close} title="Заголовок шита">
          <Text style={styles.text}>Содержимое шита: строки, поля, кнопки снизу.</Text>
        </BottomSheet>
        <TextInputModal
          visible={open === 'input'}
          title="Новый раздел"
          label="Название"
          placeholder="Например, Хобби"
          submitLabel="Создать"
          onSubmit={() => {
            close();
            return Promise.resolve(null);
          }}
          onClose={close}
        />
        <EmojiPicker visible={open === 'emoji'} value={emoji} onPick={setEmoji} onClose={close} />
      </Frame>
      <Frame name="RangeCalendar" note="день или период: 1-й тап — день, 2-й — период, 3-й — заново">
        <RangeCalendar value={range} onChange={setRange} />
      </Frame>
      <Frame name="StepsNav · BackLink" note="шаги мастера («‹ Назад», точки); ссылка назад">
        <StepsNav
          at={step}
          count={3}
          name={`Шаг ${step + 1} из 3`}
          onBack={step ? () => setStep(step - 1) : undefined}
        />
        <Button title="Дальше" size="small" onPress={() => setStep((step + 1) % 3)} />
        <BackLink onPress={noop} />
      </Frame>
      <Frame name="Fab" note="«＋» в углу экрана поверх списка (PlusButton 48)">
        <View style={styles.fabRoom}>
          <Fab onPress={noop} accessibilityLabel="Добавить" />
        </View>
      </Frame>
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: font.body, color: colors.text, paddingHorizontal: space[20], paddingBottom: space[24] },
  fabRoom: { height: 80, backgroundColor: colors.surface },
});
