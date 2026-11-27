import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { bankById } from '@/domain/banks';
import AmountRow from '@/shared/ui/AmountRow';
import Banner from '@/shared/ui/Banner';
import BankBadge from '@/shared/ui/BankBadge';
import Empty from '@/shared/ui/Empty';
import Loading from '@/shared/ui/Loading';
import ModeBanner from '@/shared/ui/ModeBanner';
import SectionBand from '@/shared/ui/SectionBand';
import SectionHeading from '@/shared/ui/SectionHeading';
import TextLink from '@/shared/ui/TextLink';
import { RepeatIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { font, space } from '@/shared/theme/tokens';
import Frame from './Frame';

const noop = () => {};
const tbc = bankById('tbc')!;
const bog = bankById('bog')!;

/** Boxes and states: banners, empty, loading, section titles, badges. */
export default function BoxesDemo() {
  return (
    <>
      <Frame name="Banner" note="плашка: warn — сделать, info — предложение, neutral — заметка, ok — всё хорошо">
        <Banner
          title="Октябрь не закрыт"
          text="Подведите итоги: удалось ли отложить и взносы в копилки"
          close={{ label: 'Скрыть', onPress: noop }}
        >
          <TextLink label="Подвести итоги" onPress={noop} style={styles.link} />
        </Banner>
        <Banner title="Не распознано: 2" text="Сообщения банка без операции — отметьте в них сумму" onPress={noop} />
        <Banner tone="info" title="Отчёт за ноябрь" text="Пока отложено 7 436.12 ₾ · ещё 12 дней" onPress={noop} />
        <Banner tone="neutral" title="Из банка: TBC" left={<BankBadge short={tbc.short} color={tbc.color} />} />
        <Banner tone="ok" title="✓ Успеваете к 31 июля" text="Откладывать по 150 ₾ в месяц" />
        <ModeBanner text="Удаление «Такси»: 3 операции" onCancel={noop} />
      </Frame>
      <Frame name="Empty" note="пусто на месте списка; compact — в шите, inline — в блоке страницы">
        <Empty>Категорий нет. Нажмите «Создать».</Empty>
        <Empty compact>Не найдено.</Empty>
        <Empty inline>Изменений нет</Empty>
      </Frame>
      <Frame name="Loading" note="пока грузится; не загрузилось — «Повторить»">
        <Loading inline />
        <Loading failed onRetry={noop} style={styles.loading} />
      </Frame>
      <Frame name="SectionHeading · SectionBand" note="заголовок блока; серая полоса раздела с итогом">
        <SectionHeading title="Подписки" onSettings={noop} />
        <SectionBand title="Жизнь" total="2 809.33 ₾" share="27%" inset={space[16]} />
      </Frame>
      <Frame name="AmountRow" note="строка с суммой: значок · название и подписи · сумма справа; large — в шите">
        <AmountRow
          icon={<RepeatIcon color={colors.accent} size={20} />}
          title="📺 Подписки"
          notes={<Text style={styles.note}>каждый месяц · следующее 3 дек</Text>}
          amount={<Text style={styles.amount}>70 ₾ · 1%</Text>}
          onPress={noop}
          accessibilityLabel="Подписки"
        />
        <AmountRow
          large
          title="NETFLIX.COM"
          notes={<Text style={styles.note}>последняя 15 окт</Text>}
          amount={<Text style={styles.amountLarge}>70 ₾</Text>}
          onPress={noop}
          accessibilityLabel="Подписка: NETFLIX.COM"
        />
      </Frame>
      <Frame name="BankBadge" note="знак банка; large — в «Банках»">
        <View style={styles.row}>
          <BankBadge short={tbc.short} color={tbc.color} />
          <BankBadge short={bog.short} color={bog.color} large />
        </View>
      </Frame>
    </>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: font.secondary },
  loading: { flex: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  note: { fontSize: font.caption, color: colors.muted, marginTop: space[2] },
  amount: { fontSize: font.meta, color: colors.text },
  amountLarge: { fontSize: font.input, color: colors.text },
});
