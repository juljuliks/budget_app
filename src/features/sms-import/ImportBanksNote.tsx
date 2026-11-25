import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { enabledBanks } from '@/db/banks';
import { bankById, BankId } from '@/domain/banks';
import { navigationRef } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import Banner from '@/shared/ui/Banner';
import TextLink from '@/shared/ui/TextLink';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** In "Импорт SMS": which banks' SMS it reads (the ones on), and where to turn on others ("Банки"). */
export default function ImportBanksNote({ close }: { close: () => void }) {
  const [ids, setIds] = useState<BankId[]>([]);
  useEffect(() => {
    enabledBanks()
      .then(setIds)
      .catch((e) => console.error('load banks failed', e));
  }, []);
  const banks = ids.map((id) => bankById(id)!);
  if (!banks.length) return null;
  return (
    <Banner
      tone="neutral"
      title={`Из ${banks.length > 1 ? 'банков' : 'банка'}: ${banks.map((b) => b.name).join(', ')}`}
      left={
        <View style={styles.badges}>
          {banks.map((b) => (
            <View key={b.id} style={[styles.badge, { backgroundColor: b.color }]}>
              <Text style={styles.badgeText}>{b.short}</Text>
            </View>
          ))}
        </View>
      }
      style={styles.box}
    >
      <TextLink
        label="Другие банки — в «Банках»"
        onPress={() => {
          close();
          navigationRef.navigate('Banks');
        }}
        style={styles.link}
      />
    </Banner>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: space[6] },
  badges: { flexDirection: 'row', gap: space[4] },
  badge: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: font.micro, fontWeight: weight.bold, color: colors.onAccent },
  link: { fontSize: font.secondary },
});
