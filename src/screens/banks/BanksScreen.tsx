import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { toggleBank } from '@/features/banks';
import { formatDay, formatTime, plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { useRootNavigation } from '@/shared/navigation/navigation';
import Loading from '@/shared/ui/Loading';
import { toast, toastFailure } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';
import { BankInfo, useBanksInfo } from './model/useBanksInfo';
import { font, radius, space, weight } from '@/shared/theme/tokens';
import Banner from '@/shared/ui/Banner';
import Toggle from '@/shared/ui/Toggle';

const parseOf = (i: BankInfo) => (i.bank.builtIn ? 'встроенный' : `шаблоны сообщений · ${i.templates}`);
const balanceOf = (i: BankInfo) =>
  i.balance
    ? `${i.balance.pending ? '≈ ' : ''}${formatMoneyWithCurrency(i.balance.minor, i.balance.currency)} · ${formatDay(i.balance.asOf).toLowerCase()} ${formatTime(i.balance.asOf)}`
    : '—';

/** Настройки → «Банки»: whose SMS and pushes are read, each bank on or off, how it is read, its card's balance. */
export default function BanksScreen() {
  const navigation = useRootNavigation();
  const { info, failed, load, setInfo } = useBanksInfo();
  if (!info) return <Loading failed={failed} onRetry={load} />;

  const toggle = (i: BankInfo, on: boolean) => {
    setInfo((list) => list && list.map((x) => (x.bank.id === i.bank.id ? { ...x, on } : x)));
    toggleBank(i.bank.id, on)
      .then((ids) => {
        if (!on && ids.includes(i.bank.id)) {
          toast('Хотя бы один банк должен читаться');
          load();
        }
      })
      .catch((e) => {
        load();
        toastFailure('toggle bank', SAVE_FAILED)(e);
      });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Откуда читаются операции: SMS от отправителя банка и уведомления его приложения. Остальные SMS приложение не
        видит.
      </Text>
      {info.map((i) => (
        <View key={i.bank.id} style={styles.card}>
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: i.bank.color }]}>
              <Text style={styles.badgeText}>{i.bank.short}</Text>
            </View>
            <Text style={styles.name}>{i.bank.name}</Text>
            <Toggle label={`Читать ${i.bank.name}`} value={i.on} onChange={(on) => toggle(i, on)} />
          </View>
          <View style={styles.grid}>
            <Text style={styles.key}>SMS от</Text>
            <Text style={styles.value}>{i.bank.smsLabel}</Text>
            <Text style={styles.key}>Уведомления</Text>
            <Text style={styles.value}>приложение {i.bank.name}</Text>
            <Text style={styles.key}>Разбор</Text>
            <Text style={styles.value}>{parseOf(i)}</Text>
            <Text style={styles.key}>Баланс карты</Text>
            <Text style={styles.value}>{balanceOf(i)}</Text>
          </View>
          {i.on && i.unparsed > 0 ? (
            <Banner
              text={
                <>
                  {i.unparsed} {plural(i.unparsed, ['сообщение', 'сообщения', 'сообщений'])} в «Не распознано» —
                  отметьте одно, и такие начнут читаться
                </>
              }
              onPress={() => navigation.navigate('Unparsed')}
            />
          ) : null}
        </View>
      ))}
      <Text style={styles.hint}>
        Выключенный банк не читается; его операции остаются. Переводы между своими картами — категория «🔁 Между своими
        картами»: не трата и не доход.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[16], gap: space[12] },
  hint: { fontSize: font.secondary, color: colors.muted, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space[14], gap: space[10] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[10] },
  badge: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: font.caption, fontWeight: weight.bold, color: colors.onAccent },
  name: { flex: 1, fontSize: font.input, fontWeight: weight.medium, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[6] },
  key: { width: '34%', fontSize: font.secondary, color: colors.muted },
  value: { width: '66%', fontSize: font.secondary, color: colors.text },
});
